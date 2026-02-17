import {
  IRModule, IRFunction, IRBlock, IRInstruction, IRValue, IRConstant,
  IRJump, IRJumpIf, IRCall, IRRet, IROpCode, IRType, isFloatingPointType, isPointerType
} from './IR';
import {
  ARM64CallingConvention, CallingConvention, Register, StackManager
} from './TargetArchitecture';

export interface AssemblySection {
  name: string;
  content: string;
}

export interface AssemblyProgram {
  sections: AssemblySection[];
  globals: string[];
}

export class ARM64InstructionSelector {
  private allocatedRegisters: Map<string, Register> = new Map();
  private stackManager: StackManager;
  private callingConvention: CallingConvention;

  constructor(callingConvention: CallingConvention) {
    this.callingConvention = callingConvention;
    this.stackManager = new StackManager(callingConvention);
  }

  getRegisterAllocator() {
    return {
      getRegister: (id: string) => this.allocatedRegisters.get(id),
      freeAllRegisters: () => this.allocatedRegisters.clear(),
      allocateRegister: (id: string, type: IRType) => this.allocateRegister(id, type),
      freeRegister: (id: string) => this.allocatedRegisters.delete(id),
    };
  }

  getStackManager() {
    return this.stackManager;
  }

  private allocateRegister(valueId: string, type: IRType): Register | null {
    const isFloat = isFloatingPointType(type);
    
    if (isFloat) {
      const freeReg = this.callingConvention.floatCallerSaveRegisters.find(r => !Array.from(this.allocatedRegisters.values()).some(allocated => allocated.name === r.name));
      if (freeReg) {
        this.allocatedRegisters.set(valueId, freeReg);
        return freeReg;
      }
    } else {
      const freeReg = this.callingConvention.callerSaveRegisters.find(r => !Array.from(this.allocatedRegisters.values()).some(allocated => allocated.name === r.name));
      if (freeReg) {
        this.allocatedRegisters.set(valueId, freeReg);
        return freeReg;
      }
    }
    
    return null;
  }

  selectInstructions(instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const assembly: string[] = [];
    
    switch (instruction.opcode) {
      case IROpCode.ADD:
        assembly.push(...this.selectBinaryInstruction('add', instruction, getValue));
        break;
      case IROpCode.SUB:
        assembly.push(...this.selectBinaryInstruction('sub', instruction, getValue));
        break;
      case IROpCode.MUL:
        assembly.push(...this.selectBinaryInstruction('mul', instruction, getValue));
        break;
      case IROpCode.DIV:
        assembly.push(...this.selectBinaryInstruction('sdiv', instruction, getValue));
        break;
      case IROpCode.MOD:
        assembly.push(...this.selectBinaryInstruction('sdiv', instruction, getValue));
        break;
      case IROpCode.EQ:
        assembly.push(...this.selectComparisonInstruction('eq', instruction, getValue));
        break;
      case IROpCode.NE:
        assembly.push(...this.selectComparisonInstruction('ne', instruction, getValue));
        break;
      case IROpCode.LT:
        assembly.push(...this.selectComparisonInstruction('lt', instruction, getValue));
        break;
      case IROpCode.LE:
        assembly.push(...this.selectComparisonInstruction('le', instruction, getValue));
        break;
      case IROpCode.GT:
        assembly.push(...this.selectComparisonInstruction('gt', instruction, getValue));
        break;
      case IROpCode.GE:
        assembly.push(...this.selectComparisonInstruction('ge', instruction, getValue));
        break;
      case IROpCode.AND:
        assembly.push(...this.selectBinaryInstruction('and', instruction, getValue));
        break;
      case IROpCode.OR:
        assembly.push(...this.selectBinaryInstruction('orr', instruction, getValue));
        break;
      case IROpCode.SHL:
        assembly.push(...this.selectBinaryInstruction('lsl', instruction, getValue));
        break;
      case IROpCode.SHR:
        assembly.push(...this.selectBinaryInstruction('lsr', instruction, getValue));
        break;
      case IROpCode.BAND:
        assembly.push(...this.selectBinaryInstruction('and', instruction, getValue));
        break;
      case IROpCode.BOR:
        assembly.push(...this.selectBinaryInstruction('orr', instruction, getValue));
        break;
      case IROpCode.BXOR:
        assembly.push(...this.selectBinaryInstruction('eor', instruction, getValue));
        break;
      case IROpCode.NEG:
        assembly.push(...this.selectUnaryInstruction('neg', instruction, getValue));
        break;
      case IROpCode.NOT:
        assembly.push(...this.selectUnaryInstruction('mvn', instruction, getValue));
        break;
      case IROpCode.ZEXT:
      case IROpCode.SEXT:
        assembly.push(...this.selectMoveInstruction(instruction, getValue));
        break;
      case IROpCode.LOAD:
        assembly.push(...this.selectLoadInstruction(instruction, getValue));
        break;
      case IROpCode.STORE:
        assembly.push(...this.selectStoreInstruction(instruction, getValue));
        break;
      case IROpCode.MOV:
        assembly.push(...this.selectMoveInstruction(instruction, getValue));
        break;
      default:
        console.warn(`Unhandled opcode: ${instruction.opcode}`);
    }
    
    return assembly;
  }

  private selectBinaryInstruction(mnemonic: string, instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const resultReg = this.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for binary operation');
    }
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(instruction.type);
    
    if (isFloat) {
      const floatMnemonic = instruction.type === IRType.F32 ? 'fadd' : 'fadd';
      assembly.push(`  fmov ${resultReg.name}, ${leftStr}`);
      assembly.push(`  ${floatMnemonic} ${resultReg.name}, ${resultReg.name}, ${rightStr}`);
    } else {
      assembly.push(`  mov ${resultReg.name}, ${leftStr}`);
      assembly.push(`  ${mnemonic} ${resultReg.name}, ${resultReg.name}, ${rightStr}`);
    }
    
    return assembly;
  }

  private selectComparisonInstruction(mnemonic: string, instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const [left, right] = instruction.operands;
    const leftStr = this.getOperandString(left, getValue);
    const rightStr = this.getOperandString(right, getValue);
    
    const resultReg = this.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for comparison');
    }
    
    const assembly: string[] = [];
    assembly.push(`  cmp ${leftStr}, ${rightStr}`);
    assembly.push(`  cset ${resultReg.name}, #${this.getConditionCode(mnemonic)}`);
    
    return assembly;
  }

  private getConditionCode(mnemonic: string): string {
    switch (mnemonic) {
      case 'eq': return 'eq';
      case 'ne': return 'ne';
      case 'lt': return 'lt';
      case 'le': return 'le';
      case 'gt': return 'gt';
      case 'ge': return 'ge';
      default: return 'ne';
    }
  }

  private selectUnaryInstruction(mnemonic: string, instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const operand = instruction.operands[0];
    const operandStr = this.getOperandString(operand, getValue);
    
    const resultReg = this.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for unary operation');
    }
    
    const assembly: string[] = [];
    assembly.push(`  mov ${resultReg.name}, ${operandStr}`);
    assembly.push(`  ${mnemonic} ${resultReg.name}, ${resultReg.name}`);
    
    return assembly;
  }

  private selectMoveInstruction(instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const operand = instruction.operands[0];
    const operandStr = this.getOperandString(operand, getValue);
    
    const resultReg = this.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for move');
    }
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(instruction.type);
    
    if (isFloat) {
      assembly.push(`  fmov ${resultReg.name}, ${operandStr}`);
    } else {
      assembly.push(`  mov ${resultReg.name}, ${operandStr}`);
    }
    
    return assembly;
  }

  private selectLoadInstruction(instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const [addr, offset] = instruction.operands;
    const addrStr = this.getOperandString(addr, getValue);
    const offsetVal = 'value' in offset ? offset.value : 0;
    
    const resultReg = this.allocateRegister(instruction.id, instruction.type);
    if (!resultReg) {
      throw new Error('No available registers for load');
    }
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(instruction.type);
    const is64bit = instruction.type === IRType.I64 || instruction.type === IRType.F64 || instruction.type === IRType.PTR;
    
    if (isFloat) {
      const size = instruction.type === IRType.F32 ? 's' : 'd';
      assembly.push(`  ldr ${resultReg.name}.${size}, [${addrStr}, #${offsetVal}]`);
    } else if (is64bit) {
      assembly.push(`  ldr ${resultReg.name}, [${addrStr}, #${offsetVal}]`);
    } else {
      assembly.push(`  ldr ${resultReg.name}.w, [${addrStr}, #${offsetVal}]`);
    }
    
    return assembly;
  }

  private selectStoreInstruction(instruction: IRInstruction, getValue: (id: string) => string): string[] {
    const [addr, value, offset] = instruction.operands;
    const addrStr = this.getOperandString(addr, getValue);
    const valueStr = this.getOperandString(value, getValue);
    const offsetVal = 'value' in offset ? offset.value : 0;
    
    const assembly: string[] = [];
    const isFloat = isFloatingPointType(value.type);
    const is64bit = value.type === IRType.I64 || value.type === IRType.F64 || value.type === IRType.PTR;
    
    if (isFloat) {
      const size = value.type === IRType.F32 ? 's' : 'd';
      assembly.push(`  str ${valueStr}.${size}, [${addrStr}, #${offsetVal}]`);
    } else if (is64bit) {
      assembly.push(`  str ${valueStr}, [${addrStr}, #${offsetVal}]`);
    } else {
      assembly.push(`  str ${valueStr}.w, [${addrStr}, #${offsetVal}]`);
    }
    
    return assembly;
  }

  private getOperandString(operand: IRValue | IRConstant, getValue: (id: string) => string): string {
    if ('value' in operand) {
      return `#${(operand as IRConstant).value}`;
    }
    return getValue((operand as any).id);
  }
}

export class ARM64AssemblyGenerator {
  private instructionSelector: ARM64InstructionSelector;
  private assemblyProgram: AssemblyProgram;
  private callingConvention: CallingConvention;

  constructor(callingConvention: CallingConvention = ARM64CallingConvention) {
    this.callingConvention = callingConvention;
    this.instructionSelector = new ARM64InstructionSelector(callingConvention);
    this.assemblyProgram = {
      sections: [],
      globals: [],
    };
  }

  generate(module: IRModule): AssemblyProgram {
    this.assemblyProgram = {
      sections: [],
      globals: [],
    };

    this.generateDataSection(module.globals);
    this.generateTextSection(module.functions);

    return this.assemblyProgram;
  }

  private generateDataSection(globals: Array<any>): void {
    if (globals.length === 0) return;

    let dataSection = '.data\n';
    
    for (const global of globals) {
      dataSection += `  .globl ${global.name}\n`;
      if (global.isArray && global.arraySize) {
        dataSection += `  .align 4\n`;
      }
      dataSection += `  ${global.name}:\n`;
      
      if (global.initializer !== undefined) {
        if (Array.isArray(global.initializer)) {
          for (const init of global.initializer) {
            if (global.type === IRType.I32 || global.type === IRType.F32) {
              dataSection += `  .word ${init.value}\n`;
            } else if (global.type === IRType.I8) {
              dataSection += `  .byte ${init.value}\n`;
            } else if (global.type === IRType.I64 || global.type === IRType.F64 || global.type === IRType.PTR) {
              dataSection += `  .quad ${init.value}\n`;
            }
          }
          
          if (global.isArray && global.arraySize > global.initializer.length) {
            const remaining = global.arraySize - global.initializer.length;
            const size = this.getTypeSize(global.type);
            dataSection += `  .zero ${remaining * size}\n`;
          }
        } else {
          if (global.type === IRType.I32 || global.type === IRType.F32) {
            dataSection += `  .word ${global.initializer.value}\n`;
          } else if (global.type === IRType.I8) {
            dataSection += `  .byte ${global.initializer.value}\n`;
          } else if (global.type === IRType.I64 || global.type === IRType.F64 || global.type === IRType.PTR) {
            dataSection += `  .quad ${global.initializer.value}\n`;
          }
        }
      } else if (global.isArray && global.arraySize) {
        const size = this.getTypeSize(global.type);
        this.assemblyProgram.globals.push(`  .globl ${global.name}\n`);
        this.assemblyProgram.globals.push(`  .comm ${global.name}, ${global.arraySize * size}, 16\n`);
        continue;
      } else {
        this.assemblyProgram.globals.push(`  .globl ${global.name}\n`);
        this.assemblyProgram.globals.push(`  .comm ${global.name}, ${this.getTypeSize(global.type)}, 4\n`);
        continue;
      }
    }

    if (dataSection !== '.data\n') {
      this.assemblyProgram.sections.push({
        name: '.data',
        content: dataSection,
      });
    }

    if (this.assemblyProgram.globals.length > 0) {
      this.assemblyProgram.sections.push({
        name: '.bss',
        content: '.bss\n' + this.assemblyProgram.globals.join(''),
      });
    }
  }

  private generateTextSection(functions: IRFunction[]): void {
    let textSection = '.text\n';
    
    for (const func of functions) {
      textSection += this.generateFunction(func);
    }

    this.assemblyProgram.sections.push({
      name: '.text',
      content: textSection,
    });
  }

  private generateFunction(func: IRFunction): string {
    let prologue = `.globl ${func.name}\n`;
    prologue += `${func.name}:\n`;

    this.instructionSelector.getRegisterAllocator().freeAllRegisters();
    this.instructionSelector.getStackManager().reset();

    for (const local of func.locals) {
      const size = this.getTypeSize(local.type);
      this.instructionSelector.getStackManager().allocateStackSpace(local.name, size);
    }

    let bodyAssembly = '';
    for (const block of func.body) {
      bodyAssembly += this.generateBlock(block, func);
    }

    const finalStackSize = this.instructionSelector.getStackManager().getTotalSize();
    const alignedStackSize = Math.ceil((finalStackSize + 16) / 16) * 16;

    let assembly = prologue;
    
    assembly += `  stp x29, x30, [sp, #-${alignedStackSize}]!\n`;
    assembly += `  mov x29, sp\n`;

    assembly += bodyAssembly;

    return assembly;
  }

  private generateBlock(block: IRBlock, func: IRFunction): string {
    let assembly = `${block.label}:\n`;

    const getValueLocation = (valueId: string): string => {
      const reg = this.instructionSelector.getRegisterAllocator().getRegister(valueId);
      if (reg) {
        return reg.name;
      }

      const stackSlot = this.instructionSelector.getStackManager().getStackSlot(valueId);
      if (stackSlot) {
        return `[x29, #${stackSlot.offset}]`;
      }

      const paramIndex = func.parameters.findIndex(p => p.name === valueId);
      if (paramIndex >= 0) {
        const param = func.parameters[paramIndex];
        if (isFloatingPointType(param.type)) {
          const argReg = this.callingConvention.floatArgumentRegisters[paramIndex];
          if (argReg) return argReg.name;
        } else {
          const argReg = this.callingConvention.argumentRegisters[paramIndex];
          if (argReg) return argReg.name;
        }
      }

      return `[${valueId}]`;
    };

    for (const instr of block.instructions) {
      if ('opcode' in instr) {
        const irInstr = instr as IRInstruction;
        
        if (irInstr.opcode === IROpCode.ALLOCA) {
          const stackSlot = this.instructionSelector.getStackManager().allocateStackSpace(
            irInstr.id,
            this.getTypeSize(irInstr.type)
          );
          const reg = this.instructionSelector.getRegisterAllocator().allocateRegister(irInstr.id, IRType.PTR);
          if (reg) {
            assembly += `  add ${reg.name}, x29, #${stackSlot.offset}\n`;
          }
          continue;
        }

        const instrAssembly = this.instructionSelector.selectInstructions(irInstr, getValueLocation);
        assembly += instrAssembly.join('\n') + '\n';

        for (const operand of irInstr.operands) {
          if ('id' in operand && (operand.id.startsWith('t') || operand.id.startsWith('callee'))) {
            this.instructionSelector.getRegisterAllocator().freeRegister(operand.id);
          }
        }
        
        if (irInstr.opcode !== IROpCode.LOAD) {
          this.instructionSelector.getRegisterAllocator().freeRegister(irInstr.id);
        }
      } else if ('target' in instr) {
        const jump = instr as IRJump;
        assembly += `  b ${jump.target}\n`;
      } else if ('condition' in instr) {
        const jump = instr as IRJumpIf;
        const condLocation = getValueLocation(jump.condition.id);
        assembly += `  cmp ${condLocation}, #0\n`;
        assembly += `  b.ne ${jump.trueTarget}\n`;
        assembly += `  b ${jump.falseTarget}\n`;
      } else if ('callee' in instr) {
        const call = instr as IRCall;
        
        const savedRegs: string[] = [];
        for (const reg of this.callingConvention.callerSaveRegisters.slice(0, 6)) {
          assembly += `  str ${reg.name}, [sp, #-16]!\n`;
          savedRegs.push(reg.name);
        }

        let intArgCount = 0;
        let floatArgCount = 0;
        for (let i = 0; i < call.args.length; i++) {
          const arg = call.args[i];
          if (isFloatingPointType(arg.type)) {
            if (floatArgCount < 8) {
              const argReg = this.callingConvention.floatArgumentRegisters[floatArgCount++];
              let argLocation = 'value' in arg ? `#${arg.value}` : getValueLocation(arg.id);
              assembly += `  fmov ${argReg.name}, ${argLocation}\n`;
            }
          } else {
            if (intArgCount < 8) {
              const argReg = this.callingConvention.argumentRegisters[intArgCount++];
              let argLocation = 'value' in arg ? `#${arg.value}` : getValueLocation(arg.id);
              assembly += `  mov ${argReg.name}, ${argLocation}\n`;
            }
          }
        }

        assembly += `  bl ${call.callee}\n`;

        for (let i = savedRegs.length - 1; i >= 0; i--) {
          assembly += `  ldr ${savedRegs[i]}, [sp], #16\n`;
        }

        if (call.type !== IRType.VOID) {
          const resultReg = this.instructionSelector.getRegisterAllocator().allocateRegister(call.callee, call.type);
          const returnReg = isFloatingPointType(call.type) ? this.callingConvention.floatReturnRegister : this.callingConvention.returnRegister;
          if (resultReg && resultReg.name !== returnReg.name) {
            assembly += `  mov ${resultReg.name}, ${returnReg.name}\n`;
          }
        }
      } else if ('value' in instr || (instr as any).type === 'ret') {
        const ret = instr as IRRet;
        
        const finalStackSize = this.instructionSelector.getStackManager().getTotalSize();
        const alignedStackSize = Math.ceil((finalStackSize + 16) / 16) * 16;
        
        if (ret.value) {
          if ('id' in ret.value) {
            const retLocation = getValueLocation(ret.value.id);
            const returnReg = isFloatingPointType(ret.value.type) ? this.callingConvention.floatReturnRegister : this.callingConvention.returnRegister;
            assembly += `  mov ${returnReg.name}, ${retLocation}\n`;
          } else {
            const retReg = isFloatingPointType(ret.value.type) ? this.callingConvention.floatReturnRegister : this.callingConvention.returnRegister;
            assembly += `  mov ${retReg.name}, #${(ret.value as IRConstant).value}\n`;
          }
        }
        
        assembly += `  ldp x29, x30, [sp], #${alignedStackSize}\n`;
        assembly += `  ret\n`;
      }
    }

    return assembly;
  }

  private getTypeSize(type: IRType): number {
    switch (type) {
      case IRType.I8: return 1;
      case IRType.I16: return 2;
      case IRType.I32:
      case IRType.F32: return 4;
      case IRType.I64:
      case IRType.F64:
      case IRType.PTR: return 8;
      default: return 8;
    }
  }
}

export function generateARM64Assembly(module: IRModule): string {
  const generator = new ARM64AssemblyGenerator();
  const program = generator.generate(module);
  
  return program.sections.map(s => `${s.name}\n${s.content}`).join('\n\n');
}
