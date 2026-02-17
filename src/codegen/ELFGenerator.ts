import { AssemblyProgram, AssemblySection } from './AssemblyGenerator';

export interface ELFHeader {
  magic: number[];
  class_: number;  // 1 = 32-bit, 2 = 64-bit
  data: number;    // 1 = little endian, 2 = big endian
  version: number;
  osabi: number;
  abiversion: number;
  pad: number[];
  type: number;    // 1 = relocatable, 2 = executable, 3 = shared
  machine: number; // 0x3E = x86-64
  version2: number;
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

export class ELFGenerator {
  private sections: Section[] = [];
  private symbols: Symbol[] = [];
  private stringTable: Map<string, number> = new Map();

  constructor() {
    this.initializeSections();
  }

  private initializeSections(): void {
    // Add null section (required by ELF)
    this.sections.push({
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
    });
  }

  generateObjectFile(assemblyProgram: AssemblyProgram, arch: string = 'x86-64'): Uint8Array {
    this.sections = [this.sections[0]]; // Keep null section
    this.symbols = [];
    this.stringTable.clear();
    
    // Parse assembly program and create sections
    this.parseAssemblyProgram(assemblyProgram);

    // Create section header string table
    this.createSectionHeaderStringTable();

    // Calculate offsets and addresses
    this.calculateLayout();

    // Generate the ELF file
    return this.generateELFFile(arch);
  }

  private parseAssemblyProgram(assemblyProgram: AssemblyProgram): void {
    for (const section of assemblyProgram.sections) {
      const elfSection = this.createELFSection(section);
      if (elfSection) {
        this.sections.push(elfSection);
      }
    }
  }

  private createELFSection(assemblySection: AssemblySection): Section | null {
    const content = assemblySection.content;
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    let data: Uint8Array = new Uint8Array(0);
    let type: number = 0;  // SHT_PROGBITS
    let flags: number = 0;
    
    if (assemblySection.name === '.text') {
      data = this.assembleTextSection(lines);
      type = 0x1;  // SHT_PROGBITS
      flags = 0x6;  // SHF_ALLOC + SHF_EXECINSTR
    } else if (assemblySection.name === '.data') {
      data = this.assembleDataSection(lines);
      type = 0x1;  // SHT_PROGBITS
      flags = 0x3;  // SHF_ALLOC + SHF_WRITE
    } else if (assemblySection.name === '.bss') {
      data = new Uint8Array(0); // BSS has no data in object file
      type = 0x8;  // SHT_NOBITS
      flags = 0x3;  // SHF_ALLOC + SHF_WRITE
    } else {
      return null; // Skip unknown sections
    }

    return {
      name: assemblySection.name,
      type,
      flags,
      addr: 0,
      offset: 0,
      size: data.length,
      link: 0,
      info: 0,
      addralign: 16,
      entsize: 0,
      data,
    };
  }

  private assembleTextSection(lines: string[]): Uint8Array {
    const data: number[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip labels and directives
      if (trimmed.endsWith(':') || trimmed.startsWith('.')) {
        continue;
      }
      
      // Simple x86-64 instruction encoding (very basic)
      const instruction = this.encodeInstruction(trimmed);
      if (instruction) {
        data.push(...instruction);
      }
    }
    
    return new Uint8Array(data);
  }

  private assembleDataSection(lines: string[]): Uint8Array {
    const data: number[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('.long')) {
        const value = parseInt(trimmed.split(' ')[1]);
        data.push(value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF);
      } else if (trimmed.startsWith('.byte')) {
        const value = parseInt(trimmed.split(' ')[1]);
        data.push(value & 0xFF);
      } else if (trimmed.startsWith('.quad')) {
        const value = parseInt(trimmed.split(' ')[1]);
        for (let i = 0; i < 8; i++) {
          data.push((value >> (i * 8)) & 0xFF);
        }
      }
    }
    
    return new Uint8Array(data);
  }

  private encodeInstruction(instruction: string): number[] | null {
    // Very basic x86-64 encoding - this is a simplified version
    const parts = instruction.split(/[,\s]+/).filter(p => p !== '');
    
    if (parts.length === 0) return null;
    
    const opcode = parts[0];
    
    // Simple instruction encoding
    switch (opcode) {
      case 'push':
        if (parts[1] === 'rbp') return [0x55];
        if (parts[1] === 'rax') return [0x50];
        if (parts[1] === 'rbx') return [0x53];
        break;
        
      case 'pop':
        if (parts[1] === 'rbp') return [0x5D];
        if (parts[1] === 'rax') return [0x58];
        if (parts[1] === 'rbx') return [0x5B];
        break;
        
      case 'mov':
        return this.encodeMovInstruction(parts);
        
      case 'add':
      case 'sub':
      case 'imul':
        return this.encodeArithmeticInstruction(parts);
        
      case 'ret':
        return [0xC3];
        
      case 'cmp':
        return this.encodeCmpInstruction(parts);
        
      case 'jne':
        return [0x75, 0x00]; // Will need proper offset calculation
        
      case 'jmp':
        return [0xEB, 0x00]; // Will need proper offset calculation
        
      case 'call':
        return [0xE8, 0x00, 0x00, 0x00, 0x00]; // Will need proper offset calculation
    }
    
    return null;
  }

  private encodeMovInstruction(parts: string[]): number[] | null {
    if (parts.length < 3) return null;
    
    const dst = parts[1];
    const src = parts[2];
    
    // mov immediate to register
    if (src.startsWith('$')) {
      const imm = parseInt(src.slice(1));
      
      if (dst === 'rax') return [0x48, 0xC7, 0xC0, imm & 0xFF, (imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF];
      if (dst === 'rdi') return [0x48, 0xC7, 0xC7, imm & 0xFF, (imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF];
      if (dst === 'rsi') return [0x48, 0xC7, 0xC6, imm & 0xFF, (imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF];
    }
    
    // mov between registers
    if (dst.startsWith('r') && src.startsWith('r')) {
      const dstReg = this.getRegisterCode(dst);
      const srcReg = this.getRegisterCode(src);
      if (dstReg !== null && srcReg !== null) {
        return [0x48, 0x89, 0xC0 | (dstReg << 3) | srcReg];
      }
    }
    
    return null;
  }

  private encodeArithmeticInstruction(parts: string[]): number[] | null {
    if (parts.length < 3) return null;
    
    const dst = parts[1];
    const src = parts[2];
    
    // For simplicity, implement add src, dst (where dst is a register)
    if (dst.startsWith('r') && src.startsWith('r')) {
      const dstReg = this.getRegisterCode(dst);
      const srcReg = this.getRegisterCode(src);
      
      if (dstReg !== null && srcReg !== null) {
        let opcode: number;
        
        if (parts[0] === 'add') opcode = 0x01;
        else if (parts[0] === 'sub') opcode = 0x29;
        else if (parts[0] === 'imul') opcode = 0x0F, 0xAF;
        else return null;
        
        if (parts[0] === 'imul') {
          return [0x48, 0x0F, 0xAF, 0xC0 | (dstReg << 3) | srcReg];
        } else {
          return [0x48, opcode, 0xC0 | (dstReg << 3) | srcReg];
        }
      }
    }
    
    return null;
  }

  private encodeCmpInstruction(parts: string[]): number[] | null {
    if (parts.length < 3) return null;
    
    const dst = parts[1];
    const src = parts[2];
    
    if (dst.startsWith('r') && src.startsWith('$')) {
      const imm = parseInt(src.slice(1));
      const dstReg = this.getRegisterCode(dst);
      
      if (dstReg !== null) {
        return [0x48, 0x81, 0xF8 | dstReg, imm & 0xFF, (imm >> 8) & 0xFF, (imm >> 16) & 0xFF, (imm >> 24) & 0xFF];
      }
    }
    
    return null;
  }

  private getRegisterCode(reg: string): number | null {
    const regMap: { [key: string]: number } = {
      'rax': 0, 'rcx': 1, 'rdx': 2, 'rbx': 3,
      'rsp': 4, 'rbp': 5, 'rsi': 6, 'rdi': 7,
      'r8': 0, 'r9': 1, 'r10': 2, 'r11': 3,
      'r12': 4, 'r13': 5, 'r14': 6, 'r15': 7,
    };
    
    return regMap[reg] || null;
  }

  private createSectionHeaderStringTable(): void {
    const stringTableData: number[] = [0]; // First entry is empty
    
    for (const section of this.sections) {
      this.stringTable.set(section.name, stringTableData.length);
      for (let i = 0; i < section.name.length; i++) {
        stringTableData.push(section.name.charCodeAt(i));
      }
      stringTableData.push(0); // Null terminator
    }
    
    // Add string table as the last section
    this.sections.push({
      name: '.shstrtab',
      type: 3, // SHT_STRTAB
      flags: 0,
      addr: 0,
      offset: 0,
      size: stringTableData.length,
      link: 0,
      info: 0,
      addralign: 1,
      entsize: 0,
      data: new Uint8Array(stringTableData),
    });
  }

  private calculateLayout(): void {
    let offset = 64; // ELF header size
    
    // Calculate section offsets
    for (const section of this.sections) {
      if (section.type === 8) {
        section.offset = offset;
        continue; // Skip NOBITS sections (BSS) for data, but set offset
      }
      
      section.offset = offset;
      offset += section.data.length;
    }
    
    // Update section header offset in header calculation
    // This will be recalculated in generateELFFile
  }

  private generateELFFile(arch: string = 'x86-64'): Uint8Array {
    const data: number[] = [];
    
    // First calculate layout properly
    this.calculateLayout();
    
    // Calculate section header table offset
    let currentOffset = 64; // ELF header size
    for (const section of this.sections) {
      if (section.type === 8) continue; // Skip NOBITS sections for data
      currentOffset += section.data.length;
    }
    const shoff = currentOffset;
    
    console.log('GENERATE_ELF: shoff should be:', shoff);
    
    // ELF Header
    const header: ELFHeader = {
      magic: [0x7F, 0x45, 0x4C, 0x46],
      class_: 2,      // 64-bit
      data: 1,       // little endian
      version: 1,
      osabi: 0,
      abiversion: 0,
      pad: [0, 0, 0, 0, 0, 0, 0],
      type: 1,       // relocatable
      machine: arch === 'arm64' || arch === 'aarch64' ? 0xB7 : 0x3E, // 0xB7 = ARM64, 0x3E = x86-64
      version2: 1,
      entry: 0,
      phoff: 0,
      shoff: shoff,  // Calculate actual offset
      flags: 0,
      ehsize: 64,   // ELF header size
      phentsize: 0,
      phnum: 0,
      shentsize: 64, // Section header size
      shnum: this.sections.length,
      shstrndx: this.sections.length - 1, // String table is last section
    };
    
    console.log('GENERATE_ELF: header.phoff=', header.phoff, 'header.shoff=', header.shoff);
    
    // Write ELF header
    data.push(...header.magic);
    data.push(header.class_, header.data, header.version, header.osabi, header.abiversion);
    data.push(...header.pad);
    data.push(header.type & 0xFF, (header.type >> 8) & 0xFF);
    data.push(header.machine & 0xFF, (header.machine >> 8) & 0xFF);
    data.push(header.version2 & 0xFF, (header.version2 >> 8) & 0xFF);
    
    // Write 64-bit values (little endian)
    console.log('DEBUG: About to push entry, phoff, shoff to data array');
    console.log('DEBUG: entry bytes:', this.write64(header.entry));
    data.push(...this.write64(header.entry));
    console.log('DEBUG: After entry, data.length =', data.length, 'data[24-31]:', data.slice(24, 32));
    console.log('DEBUG: phoff bytes:', this.write64(header.phoff));
    data.push(...this.write64(header.phoff));
    console.log('DEBUG: After phoff, data.length =', data.length, 'data[32-39]:', data.slice(32, 40));
    console.log('DEBUG: shoff bytes:', this.write64(header.shoff));
    data.push(...this.write64(header.shoff));
    console.log('DEBUG: After shoff, data.length =', data.length, 'data[32-48]:', data.slice(32, 48));
    data.push(...this.write32(header.flags));
    data.push(...this.write16(header.ehsize));
    data.push(...this.write16(header.phentsize));
    data.push(...this.write16(header.phnum));
    data.push(...this.write16(header.shentsize));
    data.push(...this.write16(header.shnum));
    data.push(...this.write16(header.shstrndx));
    
    // Write section data
    for (const section of this.sections) {
      if (section.type === 8) continue; // Skip NOBITS sections
      
      for (let i = 0; i < section.data.length; i++) {
        data.push(section.data[i]);
      }
    }
    
    // Write section headers
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const nameIndex = this.stringTable.get(section.name) || 0;
      
      data.push(...this.write32(nameIndex));
      data.push(...this.write32(section.type));
      data.push(...this.write64(section.flags));
      data.push(...this.write64(section.addr));
      data.push(...this.write64(section.offset));
      data.push(...this.write64(section.size));
      data.push(...this.write32(section.link));
      data.push(...this.write32(section.info));
      data.push(...this.write64(section.addralign));
      data.push(...this.write64(section.entsize));
    }
    
    return new Uint8Array(data);
  }

  private write64(value: number): number[] {
    // JavaScript bit operations are 32-bit, so we need to handle 64-bit manually
    const lower32 = (value >>> 0) & 0xFFFFFFFF;
    const upper32 = (Math.floor(value / 4294967296) >>> 0) & 0xFFFFFFFF;
    
    const result = [
      lower32 & 0xFF,
      (lower32 >> 8) & 0xFF,
      (lower32 >> 16) & 0xFF,
      (lower32 >> 24) & 0xFF,
      upper32 & 0xFF,
      (upper32 >> 8) & 0xFF,
      (upper32 >> 16) & 0xFF,
      (upper32 >> 24) & 0xFF,
    ];
    console.log('write64(', value, ') => lower=', lower32, 'upper=', upper32, 'bytes=', result);
    return result;
  }

  private write32(value: number): number[] {
    return [
      value & 0xFF,
      (value >> 8) & 0xFF,
      (value >> 16) & 0xFF,
      (value >> 24) & 0xFF,
    ];
  }

  private write16(value: number): number[] {
    return [
      value & 0xFF,
      (value >> 8) & 0xFF,
    ];
  }
}

// Utility function to generate ELF object file
export function generateELFObjectFile(assemblyProgram: AssemblyProgram, arch: string = 'x86-64'): Uint8Array {
  const generator = new ELFGenerator();
  return generator.generateObjectFile(assemblyProgram, arch);
}