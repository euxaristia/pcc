import { readFile } from 'fs/promises';
import { parseObjectFile, ParsedObjectFile, SectionInfo, SymbolInfo, RelocationInfo } from './ELFReader';

const TEXT_VADDR = 0x400000;
const PAGE_SIZE = 0x1000;
const PAGE_MASK = PAGE_SIZE - 1;

function alignUp(x: number, align: number): number {
  return (((x + align - 1) / align) | 0) * align;
}

interface MergedSection {
  name: string;
  data: Uint8Array;
  vaddr: number;
  size: number;
  fileOffset: number;
  flags: number;
  type: number;
}

interface SymbolResolution {
  defined: boolean;
  value: number;
  sectionName: string;
  binding: number;
  type: number;
  size: number;
}

// Generate _start code with placeholder call to main
const START_CODE_SIZE = 23;
function makeStartCode(): Uint8Array {
  const buf = new Uint8Array(START_CODE_SIZE);
  let off = 0;
  buf[off++] = 0x48; buf[off++] = 0x8B; buf[off++] = 0x3C; buf[off++] = 0x24; // mov rdi, [rsp]
  buf[off++] = 0x48; buf[off++] = 0x8D; buf[off++] = 0x74; buf[off++] = 0x24; buf[off++] = 0x08; // lea rsi, [rsp+8]
  buf[off++] = 0xE8; // call (placeholder rel32)
  buf[off++] = 0; buf[off++] = 0; buf[off++] = 0; buf[off++] = 0; // will fix up after prepending
  buf[off++] = 0x89; buf[off++] = 0xC7; // mov edi, eax
  buf[off++] = 0xB8; buf[off++] = 0x3C; buf[off++] = 0x00; buf[off++] = 0x00; buf[off++] = 0x00; // mov eax, 60
  buf[off++] = 0x0F; buf[off++] = 0x05; // syscall
  return buf;
}

export interface LinkerOptions {
  entryPoint?: string;
  outputType?: 'executable' | 'shared';
}

export function linkObjectFiles(objectFiles: Uint8Array[], options: LinkerOptions = {}): Uint8Array {
  const entryName = options.entryPoint || '_start';
  const parsedFiles: ParsedObjectFile[] = objectFiles.map(buf => parseObjectFile(buf));

  // Collect all defined symbols with file/section/value info
  const definedSymbols = new Map<string, { value: number; sectionIndex: number; fileIndex: number; size: number; binding: number; type: number }[]>();
  const undefinedSymbols = new Map<string, { fileIndex: number; sectionIndex: number }[]>();

  for (let fi = 0; fi < parsedFiles.length; fi++) {
    const pf = parsedFiles[fi];
    for (let si = 0; si < pf.symbols.length; si++) {
      const sym = pf.symbols[si];
      if (!sym.name) continue;

      const binding = (sym.info >> 4) & 0xF;
      const type = sym.info & 0xF;

      if (sym.shndx === 0) {
        // Undefined symbol
        if (!undefinedSymbols.has(sym.name)) undefinedSymbols.set(sym.name, []);
        undefinedSymbols.get(sym.name)!.push({ fileIndex: fi, sectionIndex: si });
      } else {
        if (!definedSymbols.has(sym.name)) definedSymbols.set(sym.name, []);
        definedSymbols.get(sym.name)!.push({
          value: sym.value,
          sectionIndex: sym.shndx,
          fileIndex: fi,
          size: sym.size,
          binding,
          type,
        });
      }
    }
  }

  // Determine which sections to merge and track contributions
  interface SectionContribution {
    fileIndex: number;
    originalSectionIndex: number;
    offsetInMerged: number;
    size: number;
    originalVaddr: number;
  }

  const sectionsToMerge = new Map<string, { contributions: SectionContribution[]; totalSize: number }>();

  for (let fi = 0; fi < parsedFiles.length; fi++) {
    const pf = parsedFiles[fi];
    for (let si = 0; si < pf.sections.length; si++) {
      const sec = pf.sections[si];
      if (sec.type === 0 || sec.type === 2 || sec.type === 3 || sec.type === 4) continue;
      if (sec.name === '' || sec.name.startsWith('.rela') || sec.name === '.symtab' || sec.name === '.strtab' || sec.name === '.shstrtab') continue;

      if (!sectionsToMerge.has(sec.name)) {
        sectionsToMerge.set(sec.name, { contributions: [], totalSize: 0 });
      }
      const entry = sectionsToMerge.get(sec.name)!;
      entry.contributions.push({
        fileIndex: fi,
        originalSectionIndex: si,
        offsetInMerged: entry.totalSize,
        size: sec.size,
        originalVaddr: sec.addr,
      });
      entry.totalSize += sec.size;
    }
  }

  // Build merged section data
  const mergedSections = new Map<string, MergedSection>();
  for (const [name, entry] of sectionsToMerge) {
    const dataParts: Uint8Array[] = [];
    for (const contrib of entry.contributions) {
      const sec = parsedFiles[contrib.fileIndex].sections[contrib.originalSectionIndex];
      if (sec.type === 8) {
        dataParts.push(new Uint8Array(sec.size));
      } else {
        dataParts.push(sec.data);
      }
    }
    const totalLen = dataParts.reduce((a, b) => a + b.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const part of dataParts) {
      merged.set(part, off);
      off += part.length;
    }
    mergedSections.set(name, {
      name,
      data: merged,
      vaddr: 0,
      size: merged.length,
      fileOffset: 0,
      flags: 0,
      type: 1,
    });
  }

  // Assign section flags
  for (const [name, sec] of mergedSections) {
    if (name === '.text') {
      sec.flags = 6;
      sec.type = 1;
    } else if (name === '.data') {
      sec.flags = 3;
      sec.type = 1;
    } else if (name === '.bss') {
      sec.flags = 3;
      sec.type = 8;
    } else if (name === '.rodata') {
      sec.flags = 2;
      sec.type = 1;
    }
  }

  // Compute symbol resolutions
  const symResolution = new Map<string, SymbolResolution>();

  // First, collect globally defined symbols
  for (const [name, defs] of definedSymbols) {
    // Take the first global definition or the first local one
    const globalDef = defs.find(d => d.binding === 1);
    const chosenDef = globalDef || defs[0];
    const fileIndex = chosenDef.fileIndex;
    const secIndex = chosenDef.sectionIndex;
    const pf = parsedFiles[fileIndex];
    const sec = pf.sections[secIndex];

    let sectionBase = 0;
    if (secIndex === 0xFFF1) {
      sectionBase = 0;
    } else if (secIndex === 0xFFF2) {
      sectionBase = 0;
    } else {
      const secName = sec.name;
      const merged = mergedSections.get(secName);
      if (merged) {
        // Find which contribution this belongs to
        const entry = sectionsToMerge.get(secName);
        if (entry) {
          for (const contrib of entry.contributions) {
            if (contrib.fileIndex === fileIndex && contrib.originalSectionIndex === secIndex) {
              sectionBase = contrib.offsetInMerged;
              break;
            }
          }
        }
      }
    }

    symResolution.set(name, {
      defined: true,
      value: chosenDef.value + sectionBase,
      sectionName: sec.name,
      binding: chosenDef.binding,
      type: chosenDef.type,
      size: chosenDef.size,
    });
  }

  // Check for undefined symbols (except _start which we'll provide)
  const undefinedRefs: string[] = [];
  for (const [name] of undefinedSymbols) {
    if (!symResolution.has(name)) {
      // Only warn if we can't provide it
      if (name !== '_start' || name !== entryName) {
        undefinedRefs.push(name);
      }
    }
  }

  // Generate _start code if needed and not provided
  let _startCode: Uint8Array | null = null;
  if (entryName === '_start' && !symResolution.has('_start') && symResolution.has('main')) {
    _startCode = makeStartCode();
    // Add _start as a symbol pointing to the text section
    const textMerged = mergedSections.get('.text');
    if (textMerged) {
      // Prepend _start to .text
      const newData = new Uint8Array(START_CODE_SIZE + textMerged.data.length);
      newData.set(_startCode, 0);
      newData.set(textMerged.data, START_CODE_SIZE);

      // Fix up call main in _start: call opcode at off=9, rel32 at off=10-13, next instr at off=14, main at START_CODE_SIZE
      const rel32 = START_CODE_SIZE - 14;
      newData[10] = rel32 & 0xFF;
      newData[11] = (rel32 >> 8) & 0xFF;
      newData[12] = (rel32 >> 16) & 0xFF;
      newData[13] = (rel32 >> 24) & 0xFF;

      textMerged.data = newData;
      textMerged.size = newData.length;

      // Adjust all symbol values in .text by START_CODE_SIZE
      for (const [, res] of symResolution) {
        if (res.sectionName === '.text') {
          res.value += START_CODE_SIZE;
        }
      }

      symResolution.set('_start', {
        defined: true,
        value: 0,
        sectionName: '.text',
        binding: 1,
        type: 2,
        size: START_CODE_SIZE,
      });
    }
  }

  // Assign virtual addresses
  const PAGE_SIZE_LOCAL = 0x1000;

  // Layout: text segment first, then data segment
  let currentVaddr = TEXT_VADDR;
  let currentFileOffset = 0;

  // ELF header + program headers take space
  const ehSize = 64;
  const phdrSize = 56;

  // Layout sections
  const execSections: MergedSection[] = [];
  const dataSections: MergedSection[] = [];

  for (const [name, sec] of mergedSections) {
    if (name === '.text' || name === '.rodata' || name === '.init' || name === '.fini') {
      execSections.push(sec);
    } else if (name === '.data' || name === '.bss') {
      dataSections.push(sec);
    } else {
      execSections.push(sec);
    }
  }

  // Determine number of program headers
  const hasDataSections = dataSections.length > 0;
  const phdrCount = hasDataSections ? 3 : 1;
  const headersSize = ehSize + phdrCount * phdrSize;

  // Text segment begins after headers
  currentVaddr = TEXT_VADDR + headersSize;
  currentFileOffset = headersSize;

  // Assign exec section VAs
  for (const sec of execSections) {
    sec.vaddr = currentVaddr;
    sec.fileOffset = currentFileOffset;
    currentVaddr += sec.size;
    currentFileOffset += sec.size;
  }

  const textSegFileSize = currentFileOffset;
  const textSegMemSize = currentVaddr - TEXT_VADDR;

  // Data segment
  let dataStartVaddr = currentVaddr;
  let dataStartFileOffset = currentFileOffset;

  if (hasDataSections) {
    dataStartVaddr = alignUp(currentVaddr, PAGE_SIZE_LOCAL);
    dataStartFileOffset = alignUp(currentFileOffset, PAGE_SIZE_LOCAL);
    currentVaddr = dataStartVaddr;
    currentFileOffset = dataStartFileOffset;

    for (const sec of dataSections) {
      sec.vaddr = currentVaddr;
      sec.fileOffset = currentFileOffset;
      currentVaddr += sec.size;
      currentFileOffset += sec.size;
    }
  }

  const totalFileSize = currentFileOffset;
  const totalVaddrSize = currentVaddr;

  // Apply relocations
  for (let fi = 0; fi < parsedFiles.length; fi++) {
    const pf = parsedFiles[fi];
    for (let si = 0; si < pf.sections.length; si++) {
      const relocs = pf.relocsBySection[si];
      if (!relocs) continue;

      const sec = pf.sections[si];
      const secName = sec.name;
      const merged = mergedSections.get(secName);
      if (!merged) continue;

      // Find contribution offset
      let contributionBase = 0;
      const entry = sectionsToMerge.get(secName);
      if (entry) {
        for (const contrib of entry.contributions) {
          if (contrib.fileIndex === fi && contrib.originalSectionIndex === si) {
            contributionBase = contrib.offsetInMerged;
            break;
          }
        }
      }

      for (const reloc of relocs) {
        const symIdx = (reloc.info >> 32) >>> 0;
        const relocType = (reloc.info & 0xFFFFFFFF) >>> 0;

        // Get the symbol name
        let symName = '';
        if (symIdx < pf.symbols.length) {
          symName = pf.symbols[symIdx].name;
        }

        // Resolve the symbol
        let symValue = 0;
        if (symResolution.has(symName)) {
          symValue = symResolution.get(symName)!.value + merged.vaddr;
        } else if (symName === '_start' || symName === entryName) {
          symValue = TEXT_VADDR;
        } else {
          console.error(`Warning: unresolved symbol "${symName}"`);
        }

        const relocPos = contributionBase + reloc.offset;
        const P = relocPos + merged.vaddr;
        const A = reloc.addend;

        let result: number;
        switch (relocType) {
          case 1: // R_X86_64_64 - S + A
            result = symValue + A;
            merged.data[relocPos] = result & 0xFF;
            merged.data[relocPos + 1] = (result >> 8) & 0xFF;
            merged.data[relocPos + 2] = (result >> 16) & 0xFF;
            merged.data[relocPos + 3] = (result >> 24) & 0xFF;
            merged.data[relocPos + 4] = (result >> 32) & 0xFF;
            merged.data[relocPos + 5] = (result >> 40) & 0xFF;
            merged.data[relocPos + 6] = (result >> 48) & 0xFF;
            merged.data[relocPos + 7] = (result >> 56) & 0xFF;
            break;
          case 2: // R_X86_64_PC32 - S + A - P
            result = (symValue + A - P) >>> 0;
            merged.data[relocPos] = result & 0xFF;
            merged.data[relocPos + 1] = (result >> 8) & 0xFF;
            merged.data[relocPos + 2] = (result >> 16) & 0xFF;
            merged.data[relocPos + 3] = (result >> 24) & 0xFF;
            break;
          case 4: // R_X86_64_32 - S + A (zero-extended)
            result = (symValue + A) >>> 0;
            merged.data[relocPos] = result & 0xFF;
            merged.data[relocPos + 1] = (result >> 8) & 0xFF;
            merged.data[relocPos + 2] = (result >> 16) & 0xFF;
            merged.data[relocPos + 3] = (result >> 24) & 0xFF;
            break;
          case 10: // R_X86_64_32S - S + A (sign-extended)
            result = (symValue + A) | 0;
            merged.data[relocPos] = result & 0xFF;
            merged.data[relocPos + 1] = (result >> 8) & 0xFF;
            merged.data[relocPos + 2] = (result >> 16) & 0xFF;
            merged.data[relocPos + 3] = (result >> 24) & 0xFF;
            break;
          default:
            console.error(`Warning: unsupported relocation type ${relocType}`);
        }
      }
    }
  }

  // Build output ELF executable
  const output: number[] = [];

  const dataFileSize = dataSections.reduce((a, s) => a + (s.type === 8 ? 0 : s.data.length), 0);
  const dataMemSize = dataSections.reduce((a, s) => a + s.size, 0);

  // === ELF header (64 bytes) ===
  const write8 = (v: number) => output.push(v & 0xFF);
  const write16 = (v: number) => { output.push(v & 0xFF, (v >> 8) & 0xFF); };
  const write32 = (v: number) => { output.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF); };
  const write64 = (v: number) => {
    const lo = (v >>> 0) & 0xFFFFFFFF;
    const hi = (Math.floor(v / 4294967296) >>> 0) & 0xFFFFFFFF;
    output.push(lo & 0xFF, (lo >> 8) & 0xFF, (lo >> 16) & 0xFF, (lo >> 24) & 0xFF);
    output.push(hi & 0xFF, (hi >> 8) & 0xFF, (hi >> 16) & 0xFF, (hi >> 24) & 0xFF);
  };

  // e_ident
  output.push(0x7F, 0x45, 0x4C, 0x46); // magic
  output.push(2); // 64-bit
  output.push(1); // little endian
  output.push(1); // version
  output.push(0); // OS/ABI
  output.push(0); // ABI version
  for (let i = 0; i < 7; i++) output.push(0); // padding

  write16(2); // ET_EXEC
  write16(0x3E); // EM_X86_64
  write32(1); // version

  let entryPoint = TEXT_VADDR;
  if (symResolution.has('_start')) {
    const s = symResolution.get('_start')!;
    const merged = mergedSections.get(s.sectionName);
    entryPoint = s.value + (merged ? merged.vaddr : TEXT_VADDR);
  }
  write64(entryPoint);

  const phoffPos = output.length;
  write64(0); // placeholder phoff

  write64(0); // shoff
  write32(0); // flags
  write16(64); // ehsize
  write16(56); // phentsize
  const phnumPos = output.length;
  write16(0); // placeholder phnum
  write16(0); // shentsize
  write16(0); // shnum
  write16(0); // shstrndx

  // === Program headers ===
  const phdrStart = output.length;

  // Helper to fix up offsets in already-written bytes
  const write64At = (pos: number, v: number) => {
    const lo = (v >>> 0) & 0xFFFFFFFF;
    const hi = (Math.floor(v / 4294967296) >>> 0) & 0xFFFFFFFF;
    output[pos] = lo & 0xFF;
    output[pos + 1] = (lo >> 8) & 0xFF;
    output[pos + 2] = (lo >> 16) & 0xFF;
    output[pos + 3] = (lo >> 24) & 0xFF;
    output[pos + 4] = hi & 0xFF;
    output[pos + 5] = (hi >> 8) & 0xFF;
    output[pos + 6] = (hi >> 16) & 0xFF;
    output[pos + 7] = (hi >> 24) & 0xFF;
  };

  if (hasDataSections) {
    // PT_PHDR
    write32(6);
    write32(6);
    write64(phdrStart);
    write64(TEXT_VADDR + phdrStart);
    write64(TEXT_VADDR + phdrStart);
    write64(phdrCount * phdrSize);
    write64(phdrCount * phdrSize);
    write64(8);

    // PT_LOAD - text segment
    write32(1);
    write32(5);
    write64(0);
    write64(TEXT_VADDR);
    write64(TEXT_VADDR);
    write64(textSegFileSize);
    write64(textSegMemSize);
    write64(PAGE_SIZE_LOCAL);

    // PT_LOAD - data segment
    write32(1);
    write32(6);
    write64(dataStartFileOffset);
    write64(dataStartVaddr);
    write64(dataStartVaddr);
    write64(dataFileSize);
    write64(dataMemSize);
    write64(PAGE_SIZE_LOCAL);
  } else {
    // Single PT_LOAD covering everything
    write32(1);
    write32(5);
    write64(0);
    write64(TEXT_VADDR);
    write64(TEXT_VADDR);
    write64(textSegFileSize);
    write64(textSegMemSize);
    write64(PAGE_SIZE_LOCAL);
  }

  // Fixup phoff and phnum
  const phoff = phdrStart;
  const phnum = phdrCount;
  write64At(phoffPos, phoff);
  output[phnumPos] = phnum & 0xFF;
  output[phnumPos + 1] = (phnum >> 8) & 0xFF;

  // === Section data ===
  for (const sec of execSections) {
    if (sec.type === 8) continue;
    for (let i = 0; i < sec.data.length; i++) {
      output.push(sec.data[i]);
    }
  }

  if (hasDataSections) {
    while (output.length < dataStartFileOffset) {
      output.push(0);
    }
    for (const sec of dataSections) {
      if (sec.type === 8) continue;
      for (let i = 0; i < sec.data.length; i++) {
        output.push(sec.data[i]);
      }
    }
  }

  return new Uint8Array(output);
}

export function linkFiles(filePaths: string[], options: LinkerOptions = {}): Promise<Uint8Array> {
  return Promise.all(filePaths.map(f => readFile(f)))
    .then(buffers => linkObjectFiles(buffers, options));
}
