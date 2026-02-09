import { CallingConvention, RegisterAllocator, StackManager } from './CallingConvention';
import { Register } from './TargetArchitecture';

// ARM64 has 31 general purpose registers (x0-x30)
// ABI specifies x0-x7 are parameter/return registers
// x8-x15 are callee-saved registers
// x16-x31 are caller-saved registers

export interface ARM64CallingConvention extends CallingConvention {
  argumentRegisters: Register[];
  floatArgumentRegisters: Register[];
  callerSaveRegisters: Register[];
  floatCallerSaveRegisters: Register[];
  calleeSaveRegisters: Register[];
  returnRegister: Register;
  floatReturnRegister: Register;
  stackAlignment: number;
}

export const ARM64_CALLING_CONVENTION: ARM64CallingConvention = {
  name: 'ARM64 (AAPCS)',

  // Argument/Return registers (per AArch64 ABI)
  argumentRegisters: [
    { name: 'x0', number: 0, callerSave: false, argument: 0, isXMM: false },
    { name: 'x1', number: 1, callerSave: false, argument: 1, isXMM: false },
    { name: 'x2', number: 2, callerSave: false, argument: 2, isXMM: false },
    { name: 'x3', number: 3, callerSave: false, argument: 3, isXMM: false },
    { name: 'x4', number: 4, callerSave: false, argument: 4, isXMM: false },
    { name: 'x5', number: 5, callerSave: false, argument: 5, isXMM: false },
    { name: 'x6', number: 6, callerSave: false, argument: 6, isXMM: false },
    { name: 'x7', number: 7, callerSave: false, argument: 7, isXMM: false },
  ],

  // Callee-saved registers (must be preserved across function calls)
  calleeSaveRegisters: [
    { name: 'x8', number: 8, callerSave: false, argument: false, isXMM: false },
    { name: 'x9', number: 9, callerSave: false, argument: false, isXMM: false },
    { name: 'x10', number: 10, callerSave: false, argument: false, isXMM: false },
    { name: 'x11', number: 11, callerSave: false, argument: false, isXMM: false },
    { name: 'x12', number: 12, callerSave: false, argument: false, isXMM: false },
    { name: 'x13', number: 13, callerSave: false, argument: false, isXMM: false },
    { name: 'x14', number: 14, callerSave: false, argument: false, isXMM: false },
    { name: 'x15', number: 15, callerSave: false, argument: false, isXMM: false },
  ],

  // Caller-saved registers (must be preserved across function calls)
  callerSaveRegisters: [
    { name: 'x19', number: 19, callerSave: false, argument: false, isXMM: false },
    { name: 'x20', number: 20, callerSave: false, argument: false, isXMM: false },
    { name: 'x21', number: 21, callerSave: false, argument: false, isXMM: false },
    { name: 'x22', number: 22, callerSave: false, argument: false, isXMM: false },
    { name: 'x23', number: 23, callerSave: false, argument: false, isXMM: false },
    { name: 'x24', number: 24, callerSave: false, argument: false, isXMM: false },
    { name: 'x25', number: 25, callerSave: false, argument: false, isXMM: false },
    { name: 'x26', number: 26, callerSave: false, argument: false, isXMM: false },
    { name: 'x27', number: 27, callerSave: false, argument: false, isXMM: false },
    { name: 'x28', number: 28, callerSave: false, argument: false, isXMM: false },
  ],

  // Special registers
  returnRegister: { name: 'x0', number: 0, callerSave: false, argument: 0, isXMM: false },
  floatReturnRegister: { name: 's0', number: 0, callerSave: false, argument: false, isXMM: false },
  stackAlignment: 16, // ARM64 requires 16-byte stack alignment
};