import { AssemblyProgram } from './AssemblyGenerator';
export interface ELFHeader {
    magic: number[];
    class_: number;
    data: number;
    version: number;
    osabi: number;
    abiversion: number;
    pad: number[];
    type: number;
    machine: number;
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
export declare class ELFGenerator {
    private sections;
    private symbols;
    private stringTable;
    constructor();
    private initializeSections;
    generateObjectFile(assemblyProgram: AssemblyProgram): Uint8Array;
    private parseAssemblyProgram;
    private createELFSection;
    private assembleTextSection;
    private assembleDataSection;
    private encodeInstruction;
    private encodeMovInstruction;
    private encodeArithmeticInstruction;
    private encodeCmpInstruction;
    private getRegisterCode;
    private createSectionHeaderStringTable;
    private calculateLayout;
    private generateELFFile;
    private write64;
    private write32;
    private write16;
}
export declare function generateELFObjectFile(assemblyProgram: AssemblyProgram): Uint8Array;
//# sourceMappingURL=ELFGenerator.d.ts.map