import { IRModule, IRFunction, IRBlock, IRInstruction, IRValue, IRConstant, IRJump, IRJumpIf, IRCall, IRRet, IROpCode, IRType, isPointerType, isFloatingPointType } from './IR';

export interface Register {
  name: string;
  number: number;
  callerSave: boolean;
  argument?: number; // Argument number if it's an argument register
  isXMM?: boolean;
}

export interface StackSlot {
  offset: number;
  size: number;
  name: string;
}

export interface CallingConvention {
  argumentRegisters: Register[];
  floatArgumentRegisters: Register[];
  callerSaveRegisters: Register[];
  floatCallerSaveRegisters: Register[];
  calleeSaveRegisters: Register[];
  returnRegister: Register;
  floatReturnRegister: Register;
  stackAlignment: number;
}

// x86-64 System V ABI calling convention
export const X8664CallingConvention: CallingConvention = {
  argumentRegisters: [
    { name: 'rdi', number: 0, callerSave: true, argument: 0 },
    { name: 'rsi', number: 1, callerSave: true, argument: 1 },
    { name: 'rdx', number: 2, callerSave: true, argument: 2 },
    { name: 'rcx', number: 3, callerSave: true, argument: 3 },
    { name: 'r8', number: 4, callerSave: true, argument: 4 },
    { name: 'r9', number: 5, callerSave: true, argument: 5 },
  ],
  floatArgumentRegisters: [
    { name: 'xmm0', number: 0, callerSave: true, argument: 0, isXMM: true },
    { name: 'xmm1', number: 1, callerSave: true, argument: 1, isXMM: true },
    { name: 'xmm2', number: 2, callerSave: true, argument: 2, isXMM: true },
    { name: 'xmm3', number: 3, callerSave: true, argument: 3, isXMM: true },
    { name: 'xmm4', number: 4, callerSave: true, argument: 4, isXMM: true },
    { name: 'xmm5', number: 5, callerSave: true, argument: 5, isXMM: true },
    { name: 'xmm6', number: 6, callerSave: true, argument: 6, isXMM: true },
    { name: 'xmm7', number: 7, callerSave: true, argument: 7, isXMM: true },
  ],
  callerSaveRegisters: [
    { name: 'rax', number: 0, callerSave: true },
    { name: 'rcx', number: 1, callerSave: true },
    { name: 'rdx', number: 2, callerSave: true },
    { name: 'rsi', number: 3, callerSave: true },
    { name: 'rdi', number: 4, callerSave: true },
    { name: 'r8', number: 5, callerSave: true },
    { name: 'r9', number: 6, callerSave: true },
    { name: 'r10', number: 7, callerSave: true },
    { name: 'r11', number: 8, callerSave: true },
  ],
  floatCallerSaveRegisters: [
    { name: 'xmm0', number: 0, callerSave: true, isXMM: true },
    { name: 'xmm1', number: 1, callerSave: true, isXMM: true },
    { name: 'xmm2', number: 2, callerSave: true, isXMM: true },
    { name: 'xmm3', number: 3, callerSave: true, isXMM: true },
    { name: 'xmm4', number: 4, callerSave: true, isXMM: true },
    { name: 'xmm5', number: 5, callerSave: true, isXMM: true },
    { name: 'xmm6', number: 6, callerSave: true, isXMM: true },
    { name: 'xmm7', number: 7, callerSave: true, isXMM: true },
    { name: 'xmm8', number: 8, callerSave: true, isXMM: true },
    { name: 'xmm9', number: 9, callerSave: true, isXMM: true },
    { name: 'xmm10', number: 10, callerSave: true, isXMM: true },
    { name: 'xmm11', number: 11, callerSave: true, isXMM: true },
    { name: 'xmm12', number: 12, callerSave: true, isXMM: true },
    { name: 'xmm13', number: 13, callerSave: true, isXMM: true },
    { name: 'xmm14', number: 14, callerSave: true, isXMM: true },
    { name: 'xmm15', number: 15, callerSave: true, isXMM: true },
  ],
  calleeSaveRegisters: [
    { name: 'rbx', number: 0, callerSave: false },
    { name: 'r12', number: 2, callerSave: false },
    { name: 'r13', number: 3, callerSave: false },
    { name: 'r14', number: 4, callerSave: false },
    { name: 'r15', number: 5, callerSave: false },
  ],
  returnRegister: { name: 'rax', number: 0, callerSave: true },
  floatReturnRegister: { name: 'xmm0', number: 0, callerSave: true, isXMM: true },
  stackAlignment: 16,
};

export class RegisterAllocator {
  private allocatedRegisters: Set<Register> = new Set();
  private variableRegisters: Map<string, Register> = new Map();
  private callingConvention: CallingConvention;

  constructor(callingConvention: CallingConvention) {
    this.callingConvention = callingConvention;
  }

  allocateRegister(valueId: string, type: IRType): Register | null {
    const isFloat = isFloatingPointType(type);
    
    if (isFloat) {
      // Allocate XMM register
      for (const reg of this.callingConvention.floatCallerSaveRegisters) {
        if (!this.allocatedRegisters.has(reg)) {
          this.allocatedRegisters.add(reg);
          this.variableRegisters.set(valueId, reg);
          return reg;
        }
      }
    } else {
      // First, try caller-save registers
      for (const reg of this.callingConvention.callerSaveRegisters) {
        if (!this.allocatedRegisters.has(reg)) {
          this.allocatedRegisters.add(reg);
          this.variableRegisters.set(valueId, reg);
          return reg;
        }
      }
      
      // If no caller-save registers available, use callee-save registers
      for (const reg of this.callingConvention.calleeSaveRegisters) {
        if (!this.allocatedRegisters.has(reg)) {
          this.allocatedRegisters.add(reg);
          this.variableRegisters.set(valueId, reg);
          return reg;
        }
      }
    }
    
    return null; // No registers available
  }

  freeRegister(valueId: string): void {
    const reg = this.variableRegisters.get(valueId);
    if (reg) {
      this.allocatedRegisters.delete(reg);
      this.variableRegisters.delete(valueId);
    }
  }

  getRegister(valueId: string): Register | null {
    return this.variableRegisters.get(valueId) || null;
  }

  freeAllRegisters(): void {
    this.allocatedRegisters.clear();
    this.variableRegisters.clear();
  }
}

export class StackManager {
  private nextOffset: number = 0;
  private slots: Map<string, StackSlot> = new Map();
  private callingConvention: CallingConvention;

  constructor(callingConvention: CallingConvention) {
    this.callingConvention = callingConvention;
  }

  allocateStackSpace(name: string, size: number): StackSlot {
    const slot = {
      offset: this.nextOffset,
      size,
      name,
    };
    
    this.slots.set(name, slot);
    this.nextOffset += size;
    
    // Align to stack alignment
    if (this.nextOffset % this.callingConvention.stackAlignment !== 0) {
      this.nextOffset += this.callingConvention.stackAlignment - 
        (this.nextOffset % this.callingConvention.stackAlignment);
    }
    
    return slot;
  }

  getStackSlot(name: string): StackSlot | null {
    return this.slots.get(name) || null;
  }

  getTotalSize(): number {
    return this.nextOffset;
  }

  reset(): void {
    this.nextOffset = 0;
    this.slots.clear();
  }
}

export class InstructionSelector {
  private registerAllocator: RegisterAllocator;
  private stackManager: StackManager;
  private callingConvention: CallingConvention;

  constructor(callingConvention: CallingConvention) {
    this.callingConvention = callingConvention;
    this.registerAllocator = new RegisterAllocator(callingConvention);
    this.stackManager = new StackManager(callingConvention);
  }

  selectInstructions(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const assembly: string[] = [];
    
    switch (instruction.opcode) {
      case IROpCode.ADD:
        assembly.push(...this.selectBinaryInstruction('add', instruction, getValue));
        break;
        
      case IROpCode.SUB:
        assembly.push(...this.selectBinaryInstruction('sub', instruction, getValue));
        break;
        
      case IROpCode.MUL:
        assembly.push(...this.selectMultiplyInstruction(instruction, getValue));
        break;
        
      case IROpCode.DIV:
        assembly.push(...this.selectDivideInstruction(instruction, getValue));
        break;
        
      case IROpCode.MOD:
        assembly.push(...this.selectModuloInstruction(instruction, getValue));
        break;
        
      case IROpCode.EQ:
        assembly.push(...this.selectComparisonInstruction('sete', instruction, getValue));
        break;
        
      case IROpCode.NE:
        assembly.push(...this.selectComparisonInstruction('setne', instruction, getValue));
        break;
        
      case IROpCode.LT:
        assembly.push(...this.selectComparisonInstruction('setl', instruction, getValue));
        break;
        
      case IROpCode.LE:
        assembly.push(...this.selectComparisonInstruction('setle', instruction, getValue));
        break;
        
      case IROpCode.GT:
        assembly.push(...this.selectComparisonInstruction('setg', instruction, getValue));
        break;
        
      case IROpCode.GE:
        assembly.push(...this.selectComparisonInstruction('setge', instruction, getValue));
        break;
        
      case IROpCode.AND:
        assembly.push(...this.selectLogicalInstruction('and', instruction, getValue));
        break;
        
      case IROpCode.OR:
        assembly.push(...this.selectLogicalInstruction('or', instruction, getValue));
        break;
        
      case IROpCode.NOT:
        assembly.push(...this.selectNotInstruction(instruction, getValue));
        break;
        
      case IROpCode.LOAD:
        assembly.push(...this.selectLoadInstruction(instruction, getValue));
        break;
        
      case IROpCode.STORE:
        assembly.push(...this.selectStoreInstruction(instruction, getValue));
        break;
        
      case IROpCode.ALLOCA:
        // Stack allocation is handled differently
        break;
        
      default:
        throw new Error(`Unsupported IR opcode: ${instruction.opcode}`);
    }
    
    return assembly;
  }

  private selectBinaryInstruction(
    mnemonic: string,
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for binary operation');
    }
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(instruction.type);
    let opMnemonic = mnemonic;

    if (isFloat) {
      if (mnemonic === 'add') opMnemonic = instruction.type === IRType.F32 ? 'addss' : 'addsd';
      else if (mnemonic === 'sub') opMnemonic = instruction.type === IRType.F32 ? 'subss' : 'subsd';
      
      const movMnemonic = instruction.type === IRType.F32 ? 'movss' : 'movsd';
      assembly.push(`${movMnemonic} ${leftStr}, ${resultReg.name}`);
      assembly.push(`${opMnemonic} ${rightStr}, ${resultReg.name}`);
    } else {
      // Move left operand to result register
      assembly.push(`mov ${leftStr}, ${resultReg.name}`);
      // Perform operation
      assembly.push(`${opMnemonic} ${rightStr}, ${resultReg.name}`);
    }
    
    return assembly;
  }

  private selectMultiplyInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for multiply');
    }
    
    const assembly: string[] = [];
    
    if (isFloatingPointType(instruction.type)) {
      const movMnemonic = instruction.type === IRType.F32 ? 'movss' : 'movsd';
      const mulMnemonic = instruction.type === IRType.F32 ? 'mulss' : 'mulsd';
      assembly.push(`${movMnemonic} ${leftStr}, ${resultReg.name}`);
      assembly.push(`${mulMnemonic} ${rightStr}, ${resultReg.name}`);
    } else {
      // Move left operand to result register
      assembly.push(`mov ${leftStr}, ${resultReg.name}`);
      // Multiply
      assembly.push(`imul ${rightStr}, ${resultReg.name}`);
    }
    
    return assembly;
  }

  private selectDivideInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    if (isFloatingPointType(instruction.type)) {
      const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
      if (!resultReg) {
        throw new Error('No available registers for divide result');
      }
      const movMnemonic = instruction.type === IRType.F32 ? 'movss' : 'movsd';
      const divMnemonic = instruction.type === IRType.F32 ? 'divss' : 'divsd';
      const assembly: string[] = [];
      assembly.push(`${movMnemonic} ${leftStr}, ${resultReg.name}`);
      assembly.push(`${divMnemonic} ${rightStr}, ${resultReg.name}`);
      return assembly;
    }

    // Division uses rax:rdx register pair
    const assembly: string[] = [];
    
    // Save registers that will be clobbered
    assembly.push('push rax');
    assembly.push('push rdx');
    
    // Move dividend to rax
    assembly.push(`mov ${leftStr}, rax`);
    
    // Sign extend rax to rdx:rax
    assembly.push('cqo');
    
    // Divide
    assembly.push(`idiv ${rightStr}`);
    
    // Move result from rax to target register
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for divide result');
    }
    assembly.push(`mov rax, ${resultReg.name}`);
    
    // Restore registers
    assembly.push('pop rdx');
    assembly.push('pop rax');
    
    return assembly;
  }

  private selectModuloInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    // Modulo uses rax:rdx register pair, result is in rdx
    const assembly: string[] = [];
    
    // Save registers that will be clobbered
    assembly.push('push rax');
    assembly.push('push rdx');
    
    // Move dividend to rax
    assembly.push(`mov ${leftStr}, rax`);
    
    // Sign extend rax to rdx:rax
    assembly.push('cqo');
    
    // Divide
    assembly.push(`idiv ${rightStr}`);
    
    // Move remainder from rdx to target register
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for modulo result');
    }
    assembly.push(`mov rdx, ${resultReg.name}`);
    
    // Restore registers
    assembly.push('pop rdx');
    assembly.push('pop rax');
    
    return assembly;
  }

  private selectComparisonInstruction(
    setInstr: string,
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(instruction.operands[0].type);

    if (isFloat) {
      const cmpMnemonic = instruction.operands[0].type === IRType.F32 ? 'ucomiss' : 'ucomisd';
      // ucomiss dest, src -> dest - src. We want left - right.
      assembly.push(`${cmpMnemonic} ${rightStr}, ${leftStr}`);
      
      let floatSetInstr = setInstr;
      if (setInstr === 'setl') floatSetInstr = 'setb';
      else if (setInstr === 'setle') floatSetInstr = 'setbe';
      else if (setInstr === 'setg') floatSetInstr = 'seta';
      else if (setInstr === 'setge') floatSetInstr = 'setae';
      
      const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
      if (!resultReg) {
        throw new Error('No available registers for comparison');
      }
      
      assembly.push(`xor ${resultReg.name}, ${resultReg.name}`);
      assembly.push(`${floatSetInstr} ${resultReg.name}`);
    } else {
      // Compare operands: cmp dest, src -> dest - src. We want left - right.
      assembly.push(`cmp ${rightStr}, ${leftStr}`);
      
      const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
      if (!resultReg) {
        throw new Error('No available registers for comparison');
      }
      
      assembly.push(`xor ${resultReg.name}, ${resultReg.name}`);
      assembly.push(`${setInstr} ${resultReg.name}`);
    }
    
    return assembly;
  }

  private selectLogicalInstruction(
    mnemonic: string,
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for logical operation');
    }
    
    const assembly: string[] = [];
    
    // Move left operand to result register
    assembly.push(`mov ${leftStr}, ${resultReg.name}`);
    
    // Perform operation
    assembly.push(`${mnemonic} ${rightStr}, ${resultReg.name}`);
    
    return assembly;
  }

  private selectNotInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [operand] = instruction.operands;
    const operandStr = this.getOperandString(operand, getValue);
    
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for not operation');
    }
    
    const assembly: string[] = [];
    
    // Move operand to result register
    assembly.push(`mov ${operandStr}, ${resultReg.name}`);
    
    // Logical not: result = (operand == 0)
    assembly.push(`cmp ${resultReg.name}, 0`);
    assembly.push(`sete ${resultReg.name}`);
    
    return assembly;
  }

  private selectLoadInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [address] = instruction.operands;
    const addressStr = this.getOperandString(address, getValue);
    
    const resultReg = this.registerAllocator.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for load');
    }

    const isFloat = isFloatingPointType(instruction.type);
    const movMnemonic = isFloat ? (instruction.type === IRType.F32 ? 'movss' : 'movsd') : 'mov';

    // If it's a pointer dereference (e.g., loading from an address held in a register)
    if (addressStr.startsWith('r') || addressStr.startsWith('e') || addressStr.startsWith('xmm')) {
       return [`${movMnemonic} (${addressStr}), ${resultReg.name}`];
    }
    
    return [`${movMnemonic} ${addressStr}, ${resultReg.name}`];
  }

  private selectStoreInstruction(
    instruction: IRInstruction,
    getValue: (id: string) => string
  ): string[] {
    const [value, address] = instruction.operands;
    const valueStr = this.getOperandString(value, getValue);
    const addressStr = this.getOperandString(address, getValue);
    
    const isFloat = isFloatingPointType(value.type);
    const movMnemonic = isFloat ? (value.type === IRType.F32 ? 'movss' : 'movsd') : 'mov';

    // If it's a pointer dereference (e.g., storing to an address held in a register)
    if (addressStr.startsWith('r') || addressStr.startsWith('e') || addressStr.startsWith('xmm')) {
       return [`${movMnemonic} ${valueStr}, (${addressStr})`];
    }

    return [`${movMnemonic} ${valueStr}, ${addressStr}`];
  }

  private getOperandString(operand: IRValue | IRConstant, getValue: (id: string) => string): string {
    if ('value' in operand) {
      // Constant
      if (operand.type === IRType.I8) {
        return `$${operand.value}`; // Immediate value
      } else {
        return `$${operand.value}`; // Immediate value
      }
    } else {
      // Value (register or memory location)
      return getValue(operand.id);
    }
  }

  // Accessors for use by the assembly generator
  getRegisterAllocator(): RegisterAllocator {
    return this.registerAllocator;
  }

  getStackManager(): StackManager {
    return this.stackManager;
  }
}