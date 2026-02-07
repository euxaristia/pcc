import { IRModule } from './IR';
export interface AssemblySection {
    name: string;
    content: string;
}
export interface AssemblyProgram {
    sections: AssemblySection[];
    globals: string[];
}
export declare class X8664AssemblyGenerator {
    private instructionSelector;
    private assemblyProgram;
    constructor();
    generate(module: IRModule): AssemblyProgram;
    private generateDataSection;
    private generateTextSection;
    private generateFunction;
    private generateBlock;
    private getTypeSize;
    formatAssembly(): string;
}
export declare function generateX8664Assembly(module: IRModule): string;
//# sourceMappingURL=AssemblyGenerator.d.ts.map