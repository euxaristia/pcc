import { IRInstruction } from './IR';
export interface Register {
    name: string;
    number: number;
    callerSave: boolean;
    argument?: number;
}
export interface StackSlot {
    offset: number;
    size: number;
    name: string;
}
export interface CallingConvention {
    argumentRegisters: Register[];
    callerSaveRegisters: Register[];
    calleeSaveRegisters: Register[];
    returnRegister: Register;
    stackAlignment: number;
}
export declare const X8664CallingConvention: CallingConvention;
export declare class RegisterAllocator {
    private allocatedRegisters;
    private variableRegisters;
    private callingConvention;
    constructor(callingConvention: CallingConvention);
    allocateRegister(valueId: string): Register | null;
    freeRegister(valueId: string): void;
    getRegister(valueId: string): Register | null;
    freeAllRegisters(): void;
}
export declare class StackManager {
    private nextOffset;
    private slots;
    private callingConvention;
    constructor(callingConvention: CallingConvention);
    allocateStackSpace(name: string, size: number): StackSlot;
    getStackSlot(name: string): StackSlot | null;
    getTotalSize(): number;
    reset(): void;
}
export declare class InstructionSelector {
    private registerAllocator;
    private stackManager;
    private callingConvention;
    constructor(callingConvention: CallingConvention);
    selectInstructions(instruction: IRInstruction, getValue: (id: string) => string): string[];
    private selectBinaryInstruction;
    private selectMultiplyInstruction;
    private selectDivideInstruction;
    private selectModuloInstruction;
    private selectComparisonInstruction;
    private selectLogicalInstruction;
    private selectNotInstruction;
    private selectLoadInstruction;
    private selectStoreInstruction;
    private getOperandString;
    getRegisterAllocator(): RegisterAllocator;
    getStackManager(): StackManager;
}
//# sourceMappingURL=TargetArchitecture.d.ts.map