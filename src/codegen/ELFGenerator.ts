import { AssemblyProgram, AssemblySection } from './AssemblyGenerator';

export interface Section {
  name: string;
  type: number;
  flags: number;
  addr: number;
  offset: number;
  size: number;
  link: number;
  info: number;
  addralign: number;
  entsize: number;
  data: Uint8Array;
}

export interface Symbol {
  name: string;
  value: number;
  size: number;
  info: number;
  other: number;
  shndx: number;
}

export interface Relocation {
  offset: number;
  symbolIndex: number;
  type: number;
  addend: number;
}

function regIndex(name: string): number {
  const map: Record<string, number> = {
    'rax': 0, 'eax': 0, 'ax': 0, 'al': 0,
    'rcx': 1, 'ecx': 1, 'cx': 1, 'cl': 1,
    'rdx': 2, 'edx': 2, 'dx': 2, 'dl': 2,
    'rbx': 3, 'ebx': 3, 'bx': 3, 'bl': 3,
    'rsp': 4, 'esp': 4, 'sp': 4, 'spl': 4,
    'rbp': 5, 'ebp': 5, 'bp': 5, 'bpl': 5,
    'rsi': 6, 'esi': 6, 'si': 6, 'sil': 6,
    'rdi': 7, 'edi': 7, 'di': 7, 'dil': 7,
    'r8': 0, 'r8d': 0, 'r8w': 0, 'r8b': 0,
    'r9': 1, 'r9d': 1, 'r9w': 1, 'r9b': 1,
    'r10': 2, 'r10d': 2, 'r10w': 2, 'r10b': 2,
    'r11': 3, 'r11d': 3, 'r11w': 3, 'r11b': 3,
    'r12': 4, 'r12d': 4, 'r12w': 4, 'r12b': 4,
    'r13': 5, 'r13d': 5, 'r13w': 5, 'r13b': 5,
    'r14': 6, 'r14d': 6, 'r14w': 6, 'r14b': 6,
    'r15': 7, 'r15d': 7, 'r15w': 7, 'r15b': 7,
  };
  return map[name] ?? -1;
}

function isExtReg(name: string): boolean {
  return name.startsWith('r') && name.length >= 2 && name[1] >= '0' && name[1] <= '9';
}

function modrm(mod: number, reg: number, rm: number): number {
  return ((mod & 3) << 6) | ((reg & 7) << 3) | (rm & 7);
}

function emitRex(w: number, r: number, x: number, b: number): number[] {
  if (w || r || x || b) {
    return [0x40 | (w ? 8 : 0) | (r ? 4 : 0) | (x ? 2 : 0) | (b ? 1 : 0)];
  }
  return [];
}

function parseMem(s: string): { mod: number; rm: number; disp: number; rexB: number } | null {
  s = s.trim();
  if (s[0] !== '[' && s[0] !== '(') return null;
  const inner = s.slice(1, -1).trim();

  let regName = '';
  let i = 0;
  while (i < inner.length && inner[i] !== '-' && inner[i] !== '+' && inner[i] !== ' ') {
    regName += inner[i];
    i++;
  }
  const rm = regIndex(regName);
  if (rm < 0) return null;
  const rexB = isExtReg(regName) ? 1 : 0;

  while (i < inner.length && inner[i] === ' ') i++;

  let disp = 0;
  if (i < inner.length && (inner[i] === '-' || inner[i] === '+')) {
    const sign = inner[i] === '-' ? -1 : 1;
    i++;
    while (i < inner.length && inner[i] === ' ') i++;
    let val = 0;
    while (i < inner.length && inner[i] >= '0' && inner[i] <= '9') {
      val = val * 10 + (inner.charCodeAt(i) - 48);
      i++;
    }
    disp = sign * val;
  }

  const mod = disp !== 0 ? (disp >= -128 && disp <= 127 ? 1 : 2) : (rm === 5 ? 0 : 0);
  return { mod, rm, disp, rexB };
}

function encPush(buf: number[], reg: string): number {
  const idx = regIndex(reg);
  if (idx < 0) return 0;
  const ext = isExtReg(reg) ? 1 : 0;
  buf.push(...emitRex(0, 0, 0, ext));
  buf.push(0x50 + idx);
  return buf.length;
}

function encPop(buf: number[], reg: string): number {
  const idx = regIndex(reg);
  if (idx < 0) return 0;
  const ext = isExtReg(reg) ? 1 : 0;
  buf.push(...emitRex(0, 0, 0, ext));
  buf.push(0x58 + idx);
  return buf.length;
}

function encMovR2R(buf: number[], dst: string, src: string): number {
  const dr = regIndex(dst);
  const sr = regIndex(src);
  if (sr < 0 || dr < 0) return 0;
  const pos = buf.length;
  buf.push(...emitRex(1, isExtReg(src) ? 1 : 0, 0, isExtReg(dst) ? 1 : 0));
  buf.push(0x89);
  buf.push(modrm(3, sr, dr));
  return buf.length - pos;
}

function encMovImm(buf: number[], imm: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0xC7);
  buf.push(modrm(3, 0, dr));
  buf.push(imm & 0xFF, (imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF);
  return buf.length - pos;
}

function encMovR2M(buf: number[], src: string, dst: string): number {
  const sr = regIndex(src);
  if (sr < 0) return 0;
  const m = parseMem(dst);
  if (m) {
    const pos = buf.length;
    buf.push(...emitRex(1, isExtReg(src) ? 1 : 0, 0, m.rexB));
    buf.push(0x89);
    buf.push(modrm(m.mod, sr, m.rm));
    if (m.mod === 1) buf.push(m.disp & 0xFF);
    else if (m.mod === 2) {
      buf.push(m.disp & 0xFF, (m.disp >> 8) & 0xFF, (m.disp >> 16) & 0xFF, (m.disp >> 24) & 0xFF);
    }
    return buf.length - pos;
  }
  return 0;
}

function encMovM2R(buf: number[], src: string, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const m = parseMem(src);
  if (m) {
    const pos = buf.length;
    buf.push(...emitRex(1, isExtReg(dst) ? 1 : 0, 0, m.rexB));
    buf.push(0x8B);
    buf.push(modrm(m.mod, dr, m.rm));
    if (m.mod === 1) buf.push(m.disp & 0xFF);
    else if (m.mod === 2) {
      buf.push(m.disp & 0xFF, (m.disp >> 8) & 0xFF, (m.disp >> 16) & 0xFF, (m.disp >> 24) & 0xFF);
    }
    return buf.length - pos;
  }
  return 0;
}

function encBinR2R(buf: number[], opcode: number, src: string, dst: string): number {
  const sr = regIndex(src);
  const dr = regIndex(dst);
  if (sr < 0 || dr < 0) return 0;
  const pos = buf.length;
  buf.push(...emitRex(1, isExtReg(src) ? 1 : 0, 0, isExtReg(dst) ? 1 : 0));
  buf.push(opcode);
  buf.push(modrm(3, sr, dr));
  return buf.length - pos;
}

function encBinImm(buf: number[], opExt: number, imm: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0x83);
  buf.push(modrm(3, opExt, dr));
  buf.push(imm & 0xFF);
  return buf.length - pos;
}

function encShiftImm(buf: number[], opExt: number, imm: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0xC1);
  buf.push(modrm(3, opExt, dr));
  buf.push(imm & 0xFF);
  return buf.length - pos;
}

function encShiftCl(buf: number[], opExt: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0xD3);
  buf.push(modrm(3, opExt, dr));
  return buf.length - pos;
}

function encCmpImm(buf: number[], dst: string, imm: number): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0x83);
  buf.push(modrm(3, 7, dr));
  buf.push(imm & 0xFF);
  return buf.length - pos;
}

function encCmpR2R(buf: number[], src: string, dst: string): number {
  const sr = regIndex(src);
  const dr = regIndex(dst);
  if (sr < 0 || dr < 0) return 0;
  const pos = buf.length;
  buf.push(...emitRex(1, isExtReg(src) ? 1 : 0, 0, isExtReg(dst) ? 1 : 0));
  buf.push(0x39);
  buf.push(modrm(3, sr, dr));
  return buf.length - pos;
}

function encSetcc(buf: number[], cc: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  if (ext || dr >= 4) {
    buf.push(...emitRex(0, 0, 0, ext));
  }
  buf.push(0x0F, 0x90 | (cc & 0xF));
  buf.push(modrm(3, 0, dr));
  return buf.length - pos;
}

function encCqo(buf: number[]): number {
  buf.push(0x48, 0x99);
  return 2;
}

function encIdiv(buf: number[], src: string): number {
  const sr = regIndex(src);
  if (sr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(src) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0xF7);
  buf.push(modrm(3, 7, sr));
  return buf.length - pos;
}

function encUnary(buf: number[], opExt: number, dst: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const pos = buf.length;
  const ext = isExtReg(dst) ? 1 : 0;
  buf.push(...emitRex(1, 0, 0, ext));
  buf.push(0xF7);
  buf.push(modrm(3, opExt, dr));
  return buf.length - pos;
}

function encLea(buf: number[], dst: string, mem: string): number {
  const dr = regIndex(dst);
  if (dr < 0) return 0;
  const m = parseMem(mem);
  if (!m) return 0;
  const pos = buf.length;
  buf.push(...emitRex(1, isExtReg(dst) ? 1 : 0, 0, m.rexB));
  buf.push(0x8D);
  buf.push(modrm(m.mod, dr, m.rm));
  if (m.mod === 1) buf.push(m.disp & 0xFF);
  return buf.length - pos;
}

function tokenize(line: string): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
    if (i >= line.length) break;

    if (line[i] === '$') {
      let j = i + 1;
      while (j < line.length && ((line[j] >= '0' && line[j] <= '9') || line[j] === '-')) j++;
      parts.push(line.slice(i, j));
      i = j;
    } else if (line[i] === '[' || line[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < line.length && depth > 0) {
        if (line[j] === '[' || line[j] === '(') depth++;
        else if (line[j] === ']' || line[j] === ')') depth--;
        j++;
      }
      parts.push(line.slice(i, j));
      i = j;
    } else if (line[i] === ',') {
      i++;
    } else if (line[i] === ':') {
      parts.push(':');
      i++;
      break;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ' ' && line[j] !== '\t' && line[j] !== ',' && line[j] !== ':' && line[j] !== '\n' && line[j] !== '\r') j++;
      parts.push(line.slice(i, j));
      i = j;
    }
  }
  return parts;
}

export class ELFGenerator {
  private sections: Section[] = [];
  private symbols: Symbol[] = [];
  private stringTable: Map<string, number> = new Map();
  private sectionNameIndex: Map<string, number> = new Map();

  constructor() {
    this.initializeSections();
  }

  private initializeSections(): void {
    this.sections = [{
      name: '',
      type: 0,
      flags: 0,
      addr: 0,
      offset: 0,
      size: 0,
      link: 0,
      info: 0,
      addralign: 0,
      entsize: 0,
      data: new Uint8Array(0),
    }];
  }

  generateObjectFile(assemblyProgram: AssemblyProgram, arch: string = 'x86-64'): Uint8Array {
    this.sections = [this.sections[0]];
    this.symbols = [];
    this.stringTable.clear();
    this.sectionNameIndex.clear();

    const hasText = assemblyProgram.sections.some(s => s.name === '.text' && s.content.trim());
    const hasData = assemblyProgram.sections.some(s => s.name === '.data' && s.content.trim());
    const hasBss = assemblyProgram.sections.some(s => s.name === '.bss' && s.content.trim());

    const secNames = ['', '.text', '.data', '.bss'];

    let secIdx = 1;
    if (hasText) secIdx++;
    if (hasData) secIdx++;
    if (hasBss) secIdx++;

    const symtabIdx = secIdx++;
    const strtabIdx = secIdx++;
    const relaTextIdx = hasText ? secIdx++ : -1;
    const shstrtabIdx = secIdx;

    let shstrtabData: number[] = [0];
    for (const name of [...new Set([...secNames, ...(hasText ? ['.rela.text'] : []), '.symtab', '.strtab', '.shstrtab'])]) {
      this.sectionNameIndex.set(name, shstrtabData.length);
      for (let j = 0; j < name.length; j++) shstrtabData.push(name.charCodeAt(j));
      shstrtabData.push(0);
    }

    let textData: Uint8Array = new Uint8Array(0);
    let dataData: Uint8Array = new Uint8Array(0);
    let bssSize = 0;
    let textRelocs: Relocation[] = [];
    let syms: Symbol[] = [];
    let symStrtab: number[] = [0];
    let symNameMap: Map<string, number> = new Map();

    function addSymName(name: string): number {
      if (symNameMap.has(name)) return symNameMap.get(name)!;
      const off = symStrtab.length;
      for (let j = 0; j < name.length; j++) symStrtab.push(name.charCodeAt(j));
      symStrtab.push(0);
      symNameMap.set(name, off);
      return off;
    }

    function addSymbol(name: string, value: number, size: number, binding: number, type: number, shndx: number) {
      const info = (binding << 4) | (type & 0xF);
      if (!syms.some(s => s.name === name && s.shndx === shndx)) {
        syms.push({ name, value, size, info, other: 0, shndx });
      }
    }

    function addReloc(offset: number, symName: string, relType: number, addend: number) {
      let symIdx = -1;
      for (let i = 0; i < syms.length; i++) {
        if (syms[i].name === symName) { symIdx = i + 1; break; }
      }
      if (symIdx < 0) {
        addSymbol(symName, 0, 0, 1, 0, 0);
        symIdx = syms.length;
      }
      textRelocs.push({ offset, symbolIndex: symIdx, type: relType, addend });
    }

    const textSecIdx = hasText ? 1 : -1;
    const dataSecIdx = hasData ? (hasText ? 2 : 1) : -1;
    const bssSecIdx = hasBss ? (hasData ? (hasText ? 3 : 2) : hasText ? 2 : 1) : -1;

    // Process text section with two-pass label resolution
    if (hasText) {
      const textContent = assemblyProgram.sections.find(s => s.name === '.text')!.content;
      const dataContent = hasData ? assemblyProgram.sections.find(s => s.name === '.data')!.content : '';
      const bssContent = hasBss ? assemblyProgram.sections.find(s => s.name === '.bss')!.content : '';

      // Process data section first
      if (hasData) {
        const dlines = dataContent.split('\n').map(l => l.trim()).filter(l => l);
        const dataBytes: number[] = [];
        let curDataOff = 0;
        let dataGloblName = '';

        for (const line of dlines) {
          if (line.startsWith('.globl')) {
            dataGloblName = line.split(/\s+/)[1] || '';
          } else if (line.endsWith(':')) {
            const lname = line.slice(0, -1);
            if (dataGloblName === lname) {
              addSymbol(lname, curDataOff, 0, 1, 1, dataSecIdx);
              dataGloblName = '';
            }
          } else if (line.startsWith('.long')) {
            const v = parseInt(line.split(/\s+/)[1]) || 0;
            dataBytes.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF);
            curDataOff += 4;
          } else if (line.startsWith('.byte')) {
            const v = parseInt(line.split(/\s+/)[1]) || 0;
            dataBytes.push(v & 0xFF);
            curDataOff += 1;
          } else if (line.startsWith('.quad')) {
            const v = parseInt(line.split(/\s+/)[1]) || 0;
            for (let k = 0; k < 8; k++) dataBytes.push((v >> (k * 8)) & 0xFF);
            curDataOff += 8;
          } else if (line.startsWith('.zero')) {
            const z = parseInt(line.split(/\s+/)[1]) || 0;
            for (let k = 0; k < z; k++) dataBytes.push(0);
            curDataOff += z;
          }
        }
        dataData = new Uint8Array(dataBytes);
      }

      // Process BSS
      if (hasBss) {
        const blines = bssContent.split('\n').map(l => l.trim()).filter(l => l);
        for (const line of blines) {
          if (line.startsWith('.comm')) {
            const parts = line.split(',');
            const name = parts[0].split(/\s+/)[1] || '';
            const size = parseInt(parts[1]) || 0;
            addSymbol(name, 0, size, 1, 1, 0xFFF2);
            bssSize += size;
          } else if (line.startsWith('.lcomm')) {
            const parts = line.split(',');
            const name = parts[0].split(/\s+/)[1] || '';
            const size = parseInt(parts[1]) || 0;
            addSymbol(name, 0, size, 0, 1, bssSecIdx);
            bssSize += size;
          }
        }
      }

      // Process text: first pass - collect labels and globals
      const tlines = textContent.split('\n').map(l => l.trim()).filter(l => l);
      const labels = new Map<string, number>();
      let globlNext = '';

      for (const line of tlines) {
        if (line.startsWith('.globl')) {
          globlNext = line.split(/\s+/)[1] || '';
        } else if (line.endsWith(':')) {
          const lname = line.slice(0, -1);
          if (!labels.has(lname)) {
            labels.set(lname, 0);
          }
        }
      }

      // Actually compute label offsets by simulating encoding
      {
        let off = 0;
        let curGlobl = '';

        for (const line of tlines) {
          if (line.startsWith('.globl')) {
            curGlobl = line.split(/\s+/)[1] || '';
            continue;
          }
          if (line.endsWith(':')) {
            const lname = line.slice(0, -1);
            labels.set(lname, off);
            if (curGlobl === lname) {
              addSymbol(lname, off, 0, 1, 2, textSecIdx);
              curGlobl = '';
            }
            continue;
          }
          if (line.startsWith('.')) continue;

          const parts = tokenize(line);
          if (parts.length === 0) continue;
          const op = parts[0];

          // Compute instruction size
          const buf: number[] = [];
          const ret = encodeOp(buf, op, parts, off, labels);
          if (ret >= 0) {
            off += ret;
          }
        }
      }

      // Second pass: actually encode with labels resolved
      {
        const textBytes: number[] = [];
        let curGlobl = '';
        let funcNameForReloc = '';

        for (const line of tlines) {
          if (line.startsWith('.globl')) {
            curGlobl = line.split(/\s+/)[1] || '';
            continue;
          }
          if (line.endsWith(':')) {
            const lname = line.slice(0, -1);
            funcNameForReloc = lname;
            continue;
          }
          if (line.startsWith('.')) continue;

          const parts = tokenize(line);
          if (parts.length === 0) continue;
          const op = parts[0];

          const buf: number[] = [];
          const ret = encodeOp(buf, op, parts, textBytes.length, labels);
          if (ret > 0) {
            textBytes.push(...buf);
          }
        }

        textData = new Uint8Array(textBytes);
      }
    }

    const relocStrBytes: number[] = [];

    // Build section data
    const secData: Section[] = [];

    // Null section
    secData.push({ name: '', type: 0, flags: 0, addr: 0, offset: 0, size: 0, link: 0, info: 0, addralign: 0, entsize: 0, data: new Uint8Array(0) });

    if (hasText) {
      secData.push({ name: '.text', type: 1, flags: 6, addr: 0, offset: 0, size: textData.length, link: 0, info: 0, addralign: 16, entsize: 0, data: textData });
    }
    if (hasData) {
      secData.push({ name: '.data', type: 1, flags: 3, addr: 0, offset: 0, size: dataData.length, link: 0, info: 0, addralign: 16, entsize: 0, data: dataData });
    }
    if (hasBss) {
      secData.push({ name: '.bss', type: 8, flags: 3, addr: 0, offset: 0, size: bssSize, link: 0, info: 0, addralign: 16, entsize: 0, data: new Uint8Array(0) });
    }

    const actualSymtabIdx = secData.length;
    const actualStrtabIdx = secData.length + 1;
    const relaTextSecData: Section | null = hasText ? {
      name: '.rela.text', type: 4, flags: 0, addr: 0, offset: 0, size: textRelocs.length * 24,
      link: actualSymtabIdx, info: 1, addralign: 8, entsize: 24, data: new Uint8Array(0),
    } : null;

    // Symbol table data
    const symtabBytes: number[] = [];
    // Null symbol
    symtabBytes.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    // Prevent shadow
    const existingNames = new Set<string>();
    for (const s of syms) {
      let idx = symtabBytes.length;
      const namOff = addSymName(s.name);
      symtabBytes.push(namOff & 0xFF, (namOff >> 8) & 0xFF, (namOff >> 16) & 0xFF, (namOff >> 24) & 0xFF);
      symtabBytes.push(s.info, s.other);
      symtabBytes.push(s.shndx & 0xFF, (s.shndx >> 8) & 0xFF);
      const vLow = s.value >>> 0;
      const vHigh = Math.floor(s.value / 4294967296) >>> 0;
      symtabBytes.push(vLow & 0xFF, (vLow >> 8) & 0xFF, (vLow >> 16) & 0xFF, (vLow >> 24) & 0xFF);
      symtabBytes.push(vHigh & 0xFF, (vHigh >> 8) & 0xFF, (vHigh >> 16) & 0xFF, (vHigh >> 24) & 0xFF);
      const sLow = s.size >>> 0;
      const sHigh = Math.floor(s.size / 4294967296) >>> 0;
      symtabBytes.push(sLow & 0xFF, (sLow >> 8) & 0xFF, (sLow >> 16) & 0xFF, (sLow >> 24) & 0xFF);
      symtabBytes.push(sHigh & 0xFF, (sHigh >> 8) & 0xFF, (sHigh >> 16) & 0xFF, (sHigh >> 24) & 0xFF);
    }

    // Relocation data
    const relaBytes: number[] = [];
    for (const r of textRelocs) {
      const oLow = r.offset >>> 0;
      const oHigh = Math.floor(r.offset / 4294967296) >>> 0;
      relaBytes.push(oLow & 0xFF, (oLow >> 8) & 0xFF, (oLow >> 16) & 0xFF, (oLow >> 24) & 0xFF);
      relaBytes.push(oHigh & 0xFF, (oHigh >> 8) & 0xFF, (oHigh >> 16) & 0xFF, (oHigh >> 24) & 0xFF);

      const infoVal = (r.symbolIndex * 4294967296) + r.type;
      const iLow = infoVal >>> 0;
      const iHigh = Math.floor(infoVal / 4294967296) >>> 0;
      relaBytes.push(iLow & 0xFF, (iLow >> 8) & 0xFF, (iLow >> 16) & 0xFF, (iLow >> 24) & 0xFF);
      relaBytes.push(iHigh & 0xFF, (iHigh >> 8) & 0xFF, (iHigh >> 16) & 0xFF, (iHigh >> 24) & 0xFF);

      const aLow = r.addend >>> 0;
      const aHigh = Math.floor(r.addend / 4294967296) >>> 0;
      relaBytes.push(aLow & 0xFF, (aLow >> 8) & 0xFF, (aLow >> 16) & 0xFF, (aLow >> 24) & 0xFF);
      relaBytes.push(aHigh & 0xFF, (aHigh >> 8) & 0xFF, (aHigh >> 16) & 0xFF, (aHigh >> 24) & 0xFF);
    }

    if (relaTextSecData) {
      relaTextSecData.data = new Uint8Array(relaBytes);
      relaTextSecData.size = relaBytes.length;
    }

    secData.push({
      name: '.symtab', type: 2, flags: 0, addr: 0, offset: 0, size: symtabBytes.length,
      link: actualStrtabIdx, info: secData.length > 1 ? secData.length : 1,
      addralign: 8, entsize: 24, data: new Uint8Array(symtabBytes),
    });
    secData.push({
      name: '.strtab', type: 3, flags: 0, addr: 0, offset: 0, size: symStrtab.length,
      link: 0, info: 0, addralign: 1, entsize: 0, data: new Uint8Array(symStrtab),
    });
    if (relaTextSecData) {
      secData.push(relaTextSecData);
    }
    secData.push({
      name: '.shstrtab', type: 3, flags: 0, addr: 0, offset: 0, size: shstrtabData.length,
      link: 0, info: 0, addralign: 1, entsize: 0, data: new Uint8Array(shstrtabData),
    });

    this.sections = secData;
    this.symbols = syms;

    // Calculate layout and generate ELF
    const is32Bit = false;
    let currentOffset = 64;
    for (const sec of this.sections) {
      if (sec.type === 8) continue;
      sec.offset = currentOffset;
      currentOffset += sec.data.length;
    }
    const shoff = currentOffset;

    const data: number[] = [];

    // ELF header
    const machine = arch === 'arm64' || arch === 'aarch64' ? 0xB7 : 0x3E;
    data.push(0x7F, 0x45, 0x4C, 0x46);
    data.push(2, 1, 1, 0, 0);
    for (let i = 0; i < 7; i++) data.push(0);
    data.push(1, 0); // ET_REL
    data.push(machine & 0xFF, (machine >> 8) & 0xFF);
    data.push(1, 0, 0, 0); // version
    for (let i = 0; i < 8; i++) data.push(0); // entry
    for (let i = 0; i < 8; i++) data.push(0); // phoff
    const shoffPos = data.length;
    data.push(...this.write64(0)); // placeholder shoff
    data.push(0, 0, 0, 0); // flags
    data.push(64, 0); // ehsize
    data.push(0, 0); // phentsize
    data.push(0, 0); // phnum
    data.push(64, 0); // shentsize
    const shnumPos = data.length;
    data.push(...this.write16(this.sections.length));
    const shstrndxPos = data.length;
    data.push(...this.write16(this.sections.length - 1));

    // Section data
    for (const sec of this.sections) {
      if (sec.type === 8) continue;
      for (let j = 0; j < sec.data.length; j++) {
        data.push(sec.data[j]);
      }
    }

    // Section headers
    for (let i = 0; i < this.sections.length; i++) {
      const sec = this.sections[i];
      const nameIndex = this.sectionNameIndex.get(sec.name) || 0;
      data.push(...this.write32(nameIndex));
      data.push(...this.write32(sec.type));
      data.push(...this.write64(sec.flags));
      data.push(...this.write64(sec.addr));
      data.push(...this.write64(sec.offset));
      data.push(...this.write64(sec.size));
      data.push(...this.write32(sec.link));
      data.push(...this.write32(sec.info));
      data.push(...this.write64(sec.addralign));
      data.push(...this.write64(sec.entsize));
    }

    // Fix up shoff
    this.write64At(data, shoffPos, shoff);
    this.write16At(data, shstrndxPos, this.sections.length - 1);

    return new Uint8Array(data);

    // Helper functions for encoding
    function encodeOp(buf: number[], op: string, parts: string[], curOff: number, labelMap: Map<string, number>): number {
      // Label
      if (op.endsWith(':')) return -1;
      // Directive
      if (op[0] === '.') return 0;

      // mov
      if (op === 'mov' && parts.length >= 3) {
        if (parts[1][0] === '$') {
          return encMovImm(buf, parseInt(parts[1].slice(1)), parts[2]);
        }
        // Intel syntax: mov rax, $42
        if (parts[2][0] === '$') {
          return encMovImm(buf, parseInt(parts[2].slice(1)), parts[1]);
        }
        if (parts[2][0] === '[' || parts[2][0] === '(') {
          const r = encMovR2M(buf, parts[1], parts[2]);
          if (r > 0) return r;
        }
        if (parts[1][0] === '[' || parts[1][0] === '(') {
          const r = encMovM2R(buf, parts[1], parts[2]);
          if (r > 0) return r;
        }
        // Register to register
        {
          const r = encMovR2R(buf, parts[1], parts[2]);
          if (r > 0) return r;
        }
        // mov label, reg — RIP-relative
        {
          const dr = regIndex(parts[2]);
          if (dr >= 0 && parts[1][0] !== '$' && parts[1][0] !== '[' && parts[1][0] !== '(' && regIndex(parts[1]) < 0) {
            const pos = buf.length;
            buf.push(...emitRex(1, isExtReg(parts[2]) ? 1 : 0, 0, 0));
            buf.push(0x8B);
            buf.push(modrm(0, dr, 5));
            const labelName = parts[1];
            if (labelMap.has(labelName)) {
              const targetOff = labelMap.get(labelName)!;
              const rel32 = targetOff - (curOff + pos + 5);
              buf.push(rel32 & 0xFF, (rel32 >> 8) & 0xFF, (rel32 >> 16) & 0xFF, (rel32 >> 24) & 0xFF);
            } else {
              buf.push(0, 0, 0, 0);
              addReloc(curOff + pos + 1, labelName, 2, -4);
            }
            return buf.length - pos;
          }
        }
      }

      // add/sub/and/or/xor
      if (['add', 'sub', 'and', 'or', 'xor'].includes(op) && parts.length >= 3) {
        const opExtMap: Record<string, number> = { 'add': 0, 'sub': 5, 'and': 4, 'or': 1, 'xor': 6 };
        const opcodeMap: Record<string, number> = { 'add': 0x01, 'sub': 0x29, 'and': 0x21, 'or': 0x09, 'xor': 0x31 };
        if (parts[1][0] === '$') {
          const r = encBinImm(buf, opExtMap[op], parseInt(parts[1].slice(1)), parts[2]);
          if (r > 0) return r;
        }
        const r = encBinR2R(buf, opcodeMap[op], parts[1], parts[2]);
        if (r > 0) return r;
      }

      // imul
      if (op === 'imul' && parts.length >= 3) {
        const dr = regIndex(parts[2]);
        if (dr >= 0) {
          if (parts[1][0] === '$') {
            const imm = parseInt(parts[1].slice(1));
            const pos = buf.length;
            buf.push(...emitRex(1, isExtReg(parts[2]) ? 1 : 0, 0, 0));
            buf.push(imm >= -128 && imm <= 127 ? 0x6B : 0x69);
            buf.push(modrm(3, dr, dr));
            buf.push(imm & 0xFF);
            if (imm < -128 || imm > 127) {
              buf.push((imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF);
            }
            return buf.length - pos;
          }
          const sr = regIndex(parts[1]);
          if (sr >= 0) {
            const pos = buf.length;
            buf.push(...emitRex(1, isExtReg(parts[2]) ? 1 : 0, 0, isExtReg(parts[1]) ? 1 : 0));
            buf.push(0x0F, 0xAF);
            buf.push(modrm(3, dr, sr));
            return buf.length - pos;
          }
        }
      }

      // cmp
      if (op === 'cmp' && parts.length >= 3) {
        if (parts[1][0] === '$') {
          return encCmpImm(buf, parts[2], parseInt(parts[1].slice(1)));
        }
        return encCmpR2R(buf, parts[1], parts[2]);
      }

      // setcc
      if (op.startsWith('set') && parts.length >= 2) {
        const ccNames = ['o', 'no', 'b', 'ae', 'e', 'ne', 'be', 'a', 's', 'ns', 'p', 'np', 'l', 'ge', 'le', 'g'];
        const cond = op.slice(3);
        const cc = ccNames.indexOf(cond);
        if (cc >= 0) return encSetcc(buf, cc, parts[1]);
      }

      // push/pop
      if (op === 'push' && parts.length >= 2) return encPush(buf, parts[1]);
      if (op === 'pop' && parts.length >= 2) return encPop(buf, parts[1]);

      // ret
      if (op === 'ret') { buf.push(0xC3); return 1; }

      // cqo
      if (op === 'cqo') return encCqo(buf);

      // idiv
      if (op === 'idiv' && parts.length >= 2) return encIdiv(buf, parts[1]);

      // neg/not
      if ((op === 'neg' || op === 'not') && parts.length >= 2) {
        const ext = op === 'neg' ? 3 : 2;
        return encUnary(buf, ext, parts[1]);
      }

      // shl/shr
      if ((op === 'shl' || op === 'shr') && parts.length >= 2) {
        const ext = op === 'shl' ? 4 : 5;
        if (parts.length >= 3 && parts[1][0] === '$') {
          return encShiftImm(buf, ext, parseInt(parts[1].slice(1)), parts[2]);
        }
        return encShiftCl(buf, ext, parts[1]);
      }

      // lea
      if (op === 'lea' && parts.length >= 3) {
        return encLea(buf, parts[1], parts[2]);
      }

      // call label
      if (op === 'call' && parts.length >= 2) {
        const pos = buf.length;
        buf.push(0xE8);
        const labelName = parts[1];
        if (labelMap.has(labelName)) {
          const targetOff = labelMap.get(labelName)!;
          const rel32 = targetOff - (curOff + pos + 5);
          buf.push(rel32 & 0xFF, (rel32 >> 8) & 0xFF, (rel32 >> 16) & 0xFF, (rel32 >> 24) & 0xFF);
        } else {
          buf.push(0, 0, 0, 0);
          addReloc(curOff + pos + 1, labelName, 2, -4);
        }
        return buf.length - pos;
      }

      // jmp label
      if (op === 'jmp' && parts.length >= 2) {
        const pos = buf.length;
        const labelName = parts[1];
        if (labelMap.has(labelName)) {
          const targetOff = labelMap.get(labelName)!;
          const rel32 = targetOff - (curOff + pos + 5);
          if (rel32 >= -128 && rel32 <= 127) {
            buf.push(0xEB);
            buf.push(rel32 & 0xFF);
            return buf.length - pos;
          }
          buf.push(0xE9);
          buf.push(rel32 & 0xFF, (rel32 >> 8) & 0xFF, (rel32 >> 16) & 0xFF, (rel32 >> 24) & 0xFF);
        } else {
          buf.push(0xE9, 0, 0, 0, 0);
          addReloc(curOff + pos + 1, labelName, 2, -4);
        }
        return buf.length - pos;
      }

      // Conditional jumps
      const jccNames = ['jo', 'jno', 'jb', 'jae', 'je', 'jne', 'jbe', 'ja', 'js', 'jns', 'jp', 'jnp', 'jl', 'jge', 'jle', 'jg'];
      const jccIdx = jccNames.indexOf(op);
      if (jccIdx >= 0 && parts.length >= 2) {
        const pos = buf.length;
        const labelName = parts[1];
        if (labelMap.has(labelName)) {
          const targetOff = labelMap.get(labelName)!;
          const rel32 = targetOff - (curOff + pos + 6);
          buf.push(0x0F, 0x80 | jccIdx);
          buf.push(rel32 & 0xFF, (rel32 >> 8) & 0xFF, (rel32 >> 16) & 0xFF, (rel32 >> 24) & 0xFF);
        } else {
          buf.push(0x0F, 0x80 | jccIdx);
          buf.push(0, 0, 0, 0);
          addReloc(curOff + pos + 2, labelName, 2, -4);
        }
        return buf.length - pos;
      }

      // Unknown - try zero bytes
      return 0;
    }



  }

  private write64(value: number): number[] {
    const lower32 = (value >>> 0) & 0xFFFFFFFF;
    const upper32 = (Math.floor(value / 4294967296) >>> 0) & 0xFFFFFFFF;
    return [
      lower32 & 0xFF, (lower32 >> 8) & 0xFF, (lower32 >> 16) & 0xFF, (lower32 >> 24) & 0xFF,
      upper32 & 0xFF, (upper32 >> 8) & 0xFF, (upper32 >> 16) & 0xFF, (upper32 >> 24) & 0xFF,
    ];
  }

  private write64At(data: number[], pos: number, value: number): void {
    const lower32 = (value >>> 0) & 0xFFFFFFFF;
    const upper32 = (Math.floor(value / 4294967296) >>> 0) & 0xFFFFFFFF;
    data[pos] = lower32 & 0xFF;
    data[pos + 1] = (lower32 >> 8) & 0xFF;
    data[pos + 2] = (lower32 >> 16) & 0xFF;
    data[pos + 3] = (lower32 >> 24) & 0xFF;
    data[pos + 4] = upper32 & 0xFF;
    data[pos + 5] = (upper32 >> 8) & 0xFF;
    data[pos + 6] = (upper32 >> 16) & 0xFF;
    data[pos + 7] = (upper32 >> 24) & 0xFF;
  }

  private write32(value: number): number[] {
    return [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
  }

  private write16(value: number): number[] {
    return [value & 0xFF, (value >> 8) & 0xFF];
  }

  private write16At(data: number[], pos: number, value: number): void {
    data[pos] = value & 0xFF;
    data[pos + 1] = (value >> 8) & 0xFF;
  }
}

export function generateELFObjectFile(assemblyProgram: AssemblyProgram, arch: string = 'x86-64'): Uint8Array {
  const generator = new ELFGenerator();
  return generator.generateObjectFile(assemblyProgram, arch);
}
