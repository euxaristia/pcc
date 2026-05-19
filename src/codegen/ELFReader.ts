export interface ELFHeaderInfo {
  type: number;
  machine: number;
  entry: number;
  phoff: number;
  shoff: number;
  flags: number;
  ehsize: number;
  phentsize: number;
  phnum: number;
  shentsize: number;
  shnum: number;
  shstrndx: number;
}

export interface SectionInfo {
  nameIndex: number;
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

export interface SymbolInfo {
  nameIndex: number;
  name: string;
  info: number;
  other: number;
  shndx: number;
  value: number;
  size: number;
}

export interface RelocationInfo {
  offset: number;
  info: number;
  addend: number;
}

export interface ParsedObjectFile {
  buffer: Uint8Array;
  header: ELFHeaderInfo;
  sections: SectionInfo[];
  symbols: SymbolInfo[];
  shstrtabData: Uint8Array;
  strtabData: Uint8Array;
  relocsBySection: { [sectionIndex: number]: RelocationInfo[] };
}

function read8(buf: Uint8Array, off: number): number {
  return buf[off];
}

function read16(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

function read32(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

function read64(buf: Uint8Array, off: number): number {
  const low = read32(buf, off);
  const high = read32(buf, off + 4);
  return low + high * 4294967296;
}

export function readELFHeader(buf: Uint8Array): ELFHeaderInfo {
  const magic = buf[0] === 0x7F && buf[1] === 0x45 && buf[2] === 0x4C && buf[3] === 0x46;
  if (!magic) throw new Error('Not a valid ELF file');
  if (buf[4] !== 2) throw new Error('Only 64-bit ELF is supported');
  if (buf[5] !== 1) throw new Error('Only little-endian ELF is supported');

  return {
    type: read16(buf, 16),
    machine: read16(buf, 18),
    entry: read64(buf, 24),
    phoff: read64(buf, 32),
    shoff: read64(buf, 40),
    flags: read32(buf, 48),
    ehsize: read16(buf, 52),
    phentsize: read16(buf, 54),
    phnum: read16(buf, 56),
    shentsize: read16(buf, 58),
    shnum: read16(buf, 60),
    shstrndx: read16(buf, 62),
  };
}

export function readSectionHeaders(buf: Uint8Array, header: ELFHeaderInfo, shstrtabData: Uint8Array): SectionInfo[] {
  const sections: SectionInfo[] = [];
  for (let i = 0; i < header.shnum; i++) {
    const off = header.shoff + i * header.shentsize;
    const nameIndex = read32(buf, off);
    const type = read32(buf, off + 4);
    const flags = read64(buf, off + 8);
    const addr = read64(buf, off + 16);
    const offset = read64(buf, off + 24);
    const size = read64(buf, off + 32);
    const link = read32(buf, off + 40);
    const info = read32(buf, off + 44);
    const addralign = read64(buf, off + 48);
    const entsize = read64(buf, off + 56);

    const name = readStringAt(shstrtabData, nameIndex);
    const data = buf.slice(offset, offset + size);

    sections.push({
      nameIndex,
      name,
      type,
      flags,
      addr,
      offset: type === 8 ? 0 : offset,
      size,
      link,
      info,
      addralign,
      entsize,
      data,
    });
  }
  return sections;
}

function readStringAt(data: Uint8Array, offset: number): string {
  let s = '';
  let i = offset;
  while (i < data.length && data[i] !== 0) {
    s += String.fromCharCode(data[i]);
    i++;
  }
  return s;
}

export function readStringTable(buf: Uint8Array, section: SectionInfo): Uint8Array {
  return section.data;
}

export function readSymbolTable(buf: Uint8Array, section: SectionInfo, stringData: Uint8Array): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const entrySize = section.entsize || 24;
  const count = section.size / entrySize;

  for (let i = 0; i < count; i++) {
    const off = i * entrySize;
    const nameIndex = read32(section.data, off);
    const info = read8(section.data, off + 4);
    const other = read8(section.data, off + 5);
    const shndx = read16(section.data, off + 6);
    const value = read64(section.data, off + 8);
    const size = read64(section.data, off + 16);

    const name = readStringAt(stringData, nameIndex);
    symbols.push({ nameIndex, name, info, other, shndx, value, size });
  }
  return symbols;
}

export function readRelocations(buf: Uint8Array, section: SectionInfo): RelocationInfo[] {
  const relocs: RelocationInfo[] = [];
  const entrySize = section.entsize || 24;
  const count = section.size / entrySize;

  for (let i = 0; i < count; i++) {
    const off = i * entrySize;
    const offset = read64(section.data, off);
    const info = read64(section.data, off + 8);
    const addend = read64(section.data, off + 16);
    relocs.push({ offset, info, addend });
  }
  return relocs;
}

export function parseObjectFile(buffer: Uint8Array): ParsedObjectFile {
  const header = readELFHeader(buffer);
  if (header.type !== 1) throw new Error('Only relocatable object files (ET_REL) can be linked');

  // First, parse section headers with empty string data to find shstrtab
  const sections = readSectionHeaders(buffer, header, new Uint8Array(0));
  const shstrtabSection = sections[header.shstrndx];
  if (!shstrtabSection) throw new Error('Section header string table not found');

  const shstrtabData = readStringTable(buffer, shstrtabSection);
  const sectionsWithNames = readSectionHeaders(buffer, header, shstrtabData);

  let symbols: SymbolInfo[] = [];
  let strtabData: Uint8Array = new Uint8Array(0);

  const strtabSection = sectionsWithNames.find(s => s.type === 3 && s.name === '.strtab');
  const symtabSection = sectionsWithNames.find(s => s.type === 2 && s.name === '.symtab');

  if (strtabSection && symtabSection) {
    strtabData = readStringTable(buffer, strtabSection);
    symbols = readSymbolTable(buffer, symtabSection, strtabData);
  }

  const relocsBySection: { [sectionIndex: number]: RelocationInfo[] } = {};
  for (let i = 0; i < sectionsWithNames.length; i++) {
    const sec = sectionsWithNames[i];
    if (sec.type === 4) {
      const targetSection = sec.info;
      if (!relocsBySection[targetSection]) {
        relocsBySection[targetSection] = [];
      }
      const relocs = readRelocations(buffer, sec);
      relocsBySection[targetSection].push(...relocs);
    }
  }

  return {
    buffer,
    header,
    sections: sectionsWithNames,
    symbols,
    shstrtabData,
    strtabData,
    relocsBySection,
  };
}
