import {
  IRModule, IRFunction, IRBlock, IRInstruction, IRValue, IRConstant,
  IRJump, IRJumpIf, IRCall, IRRet, IROpCode, IRType, isFloatingPointType
} from './IR';
import {
  X8664CallingConvention, CallingConvention, InstructionSelector, RegisterAllocator, StackManager
} from './TargetArchitecture';

export interface AssemblySection {
  name: string;
  content: string;
}

export interface AssemblyProgram {
  sections: AssemblySection[];
  globals: string[];
}

export class X8664AssemblyGenerator {
  private instructionSelector: InstructionSelector;
  private assemblyProgram: AssemblyProgram;

  constructor(callingConvention: CallingConvention = X8664CallingConvention) {
    this.instructionSelector = new InstructionSelector(callingConvention || X8664CallingConvention);
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

    // Generate data section for globals
    this.generateDataSection(module.globals);

    // Generate text section for functions
    this.generateTextSection(module.functions);

    return this.assemblyProgram;
  }

  private generateDataSection(globals: Array<any>): void {
    if (globals.length === 0) return;

    let dataSection = '.data\n';
    
    for (const global of globals) {
      dataSection += `  .globl ${global.name}\n`;
      if (global.isArray && global.arraySize) {
        dataSection += `  .align 16\n`; // Common for arrays
      }
      dataSection += `  ${global.name}:\n`;
      
      if (global.initializer !== undefined) {
        if (Array.isArray(global.initializer)) {
          for (const init of global.initializer) {
            if (global.type === IRType.I32 || global.type === IRType.F32) {
              dataSection += `  .long ${init.value}\n`;
            } else if (global.type === IRType.I8) {
              dataSection += `  .byte ${init.value}\n`;
            } else if (global.type === IRType.I64 || global.type === IRType.F64 || global.type === IRType.PTR) {
              dataSection += `  .quad ${init.value}\n`;
            }
          }
          
          // Padding if array is larger than initializers
          if (global.isArray && global.arraySize > global.initializer.length) {
            const remaining = global.arraySize - global.initializer.length;
            const size = this.getTypeSize(global.type);
            dataSection += `  .zero ${remaining * size}\n`;
          }
        } else {
          if (global.type === IRType.I32 || global.type === IRType.F32) {
            dataSection += `  .long ${global.initializer.value}\n`;
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
        // Uninitialized global - put in .bss section instead
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

    // Generate .bss section for uninitialized globals
    if (this.assemblyProgram.globals.length > 0) {
      this.assemblyProgram.sections.push({
        name: '.bss',
        content: '.bss\n' + this.assemblyProgram.globals.join(''),
      });
    }
  }

  private generateTextSection(functions: IRFunction[]): void {
    let textSection = '.text\n';
    
    // Generate each function
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

    // Reset register allocator and stack manager for this function
    this.instructionSelector.getRegisterAllocator().freeAllRegisters();
    this.instructionSelector.getStackManager().reset();

    // Initial stack allocation for declared locals
    for (const local of func.locals) {
      const size = this.getTypeSize(local.type);
      this.instructionSelector.getStackManager().allocateStackSpace(local.name, size);
    }

    // Generate function body first to account for all ALLOCA instructions
    let bodyAssembly = '';
    for (const block of func.body) {
      bodyAssembly += this.generateBlock(block, func);
    }

    const finalStackSize = this.instructionSelector.getStackManager().getTotalSize();

    // Build the final assembly with correct stack sizes
    let assembly = prologue;
    assembly += '  push rbp\n';
    assembly += '  mov rbp, rsp\n';
    
    if (finalStackSize > 0) {
      assembly += `  sub rsp, ${finalStackSize}\n`;
    }

    // Save callee-save registers
    for (const reg of X8664CallingConvention.calleeSaveRegisters) {
      assembly += `  push ${reg.name}\n`;
    }

    // Add the already generated body
    assembly += bodyAssembly;

    return assembly;
  }

  private generateBlock(block: IRBlock, func: IRFunction): string {
    let assembly = `${block.label}:\n`;

    // Map value IDs to their location (register or stack)
    const getValueLocation = (valueId: string): string => {
      // Check if it's in a register
      const reg = this.instructionSelector.getRegisterAllocator().getRegister(valueId);
      if (reg) {
        return reg.name;
      }

      // Check if it's a stack location
      const stackSlot = this.instructionSelector.getStackManager().getStackSlot(valueId);
      if (stackSlot) {
        return `[rbp - ${stackSlot.offset + 8}]`; // +8 to skip saved RBP
      }

      // Check if it's a function parameter
      const paramIndex = func.parameters.findIndex(p => p.name === valueId);
      if (paramIndex >= 0) {
        const param = func.parameters[paramIndex];
        if (isFloatingPointType(param.type)) {
          const argReg = X8664CallingConvention.floatArgumentRegisters[paramIndex]; // Simplified: assumes params are either all float or all int in their respective registers
          // Actually, System V ABI is more complex (it uses separate counters for int and float params)
          // For a simple compiler, we might just assume they use the same index but different registers.
          if (argReg) return argReg.name;
        } else {
          const argReg = X8664CallingConvention.argumentRegisters[paramIndex];
          if (argReg) return argReg.name;
        }
      }

      return `[${valueId}]`;
    };

    for (const instr of block.instructions) {
      if ('opcode' in instr) {
        // IR instruction
        const irInstr = instr as IRInstruction;
        
        // Handle special instructions
        if (irInstr.opcode === IROpCode.ALLOCA) {
          // Stack allocation
          const stackSlot = this.instructionSelector.getStackManager().allocateStackSpace(
            irInstr.id,
            this.getTypeSize(irInstr.type)
          );
          // Register the stack location
          const reg = this.instructionSelector.getRegisterAllocator().allocateRegister(irInstr.id, IRType.PTR);
          if (reg) {
            assembly += `  lea ${reg.name}, [rbp - ${stackSlot.offset + 8}]\n`;
            // The register is already stored in the map by allocateRegister
          }
          continue;
        }

        // Regular instruction
        const instrAssembly = this.instructionSelector.selectInstructions(irInstr, getValueLocation);
        assembly += instrAssembly.map(line => `  ${line}`).join('\n') + '\n';

        // Free registers used by operands (since each IR value is typically used once)
        for (const operand of irInstr.operands) {
          if ('id' in operand && (operand.id.startsWith('t') || operand.id.startsWith('callee'))) {
            this.instructionSelector.getRegisterAllocator().freeRegister(operand.id);
          }
        }
        
        // Free the register for this instruction result
        if (irInstr.opcode !== IROpCode.LOAD) {
          this.instructionSelector.getRegisterAllocator().freeRegister(irInstr.id);
        }
      } else if ('target' in instr) {
        const jump = instr as IRJump;
        assembly += `  jmp ${jump.target}\n`;
      } else if ('condition' in instr) {
        const jump = instr as IRJumpIf;
        const condLocation = getValueLocation(jump.condition.id);
        assembly += `  cmp ${condLocation}, 0\n`;
        assembly += `  jne ${jump.trueTarget}\n`;
        assembly += `  jmp ${jump.falseTarget}\n`;
      } else if ('callee' in instr) {
        const call = instr as IRCall;
        
        for (const reg of X8664CallingConvention.callerSaveRegisters) {
          assembly += `  push ${reg.name}\n`;
        }
        // Also save float caller-save registers
        for (const reg of X8664CallingConvention.floatCallerSaveRegisters) {
           // assembly += `  sub rsp, 8\n  movsd [rsp], ${reg.name}\n`; // Simplified
        }

        let intArgCount = 0;
        let floatArgCount = 0;
        for (let i = 0; i < call.args.length; i++) {
          const arg = call.args[i];
          if (!arg || !arg.type) {
            continue;
          }
          if (isFloatingPointType(arg.type)) {
            if (floatArgCount < 8) {
              const argReg = X8664CallingConvention.floatArgumentRegisters[floatArgCount++];
              let argLocation = 'value' in arg ? `$${arg.value}` : getValueLocation(arg.id);
              const movMnemonic = arg.type === IRType.F32 ? 'movss' : 'movsd';
              assembly += `  ${movMnemonic} ${argLocation}, ${argReg.name}\n`;
            }
          } else {
            if (intArgCount < 6) {
              const argReg = X8664CallingConvention.argumentRegisters[intArgCount++];
              let argLocation = 'value' in arg ? `$${arg.value}` : getValueLocation(arg.id);
              assembly += `  mov ${argReg.name}, ${argLocation}\n`; // Intel: mov dest, src
            }
          }
        }

        assembly += `  call ${call.callee}\n`;

        // Restore registers...

        for (let i = X8664CallingConvention.callerSaveRegisters.length - 1; i >= 0; i--) {
          const reg = X8664CallingConvention.callerSaveRegisters[i];
          assembly += `  pop ${reg.name}\n`;
        }

        if (call.type !== IRType.VOID) {
          const resultReg = this.instructionSelector.getRegisterAllocator().allocateRegister(call.callee, call.type);
          const returnReg = isFloatingPointType(call.type) ? X8664CallingConvention.floatReturnRegister : X8664CallingConvention.returnRegister;
          if (resultReg && resultReg.name !== returnReg.name) {
            const movMnemonic = isFloatingPointType(call.type) ? (call.type === IRType.F32 ? 'movss' : 'movsd') : 'mov';
            assembly += `  ${movMnemonic} ${resultReg.name}, ${returnReg.name}\n`;
          }
        }
      } else if ('value' in instr || (instr as any).type === 'ret') {
        const ret = instr as IRRet;
        
        if (ret.value) {
          const isFloat = isFloatingPointType(ret.type);
          const returnReg = isFloat ? X8664CallingConvention.floatReturnRegister : X8664CallingConvention.returnRegister;
          const movMnemonic = isFloat ? (ret.type === IRType.F32 ? 'movss' : 'movsd') : 'mov';
          
          let retLocation = 'value' in ret.value ? `$${ret.value.value}` : getValueLocation(ret.value.id);
          assembly += `  ${movMnemonic} ${returnReg.name}, ${retLocation}\n`;
        }

        for (let i = X8664CallingConvention.calleeSaveRegisters.length - 1; i >= 0; i--) {
          const reg = X8664CallingConvention.calleeSaveRegisters[i];
          assembly += `  pop ${reg.name}\n`;
        }

        const finalStackSize = this.instructionSelector.getStackManager().getTotalSize();
        if (finalStackSize > 0) {
          assembly += `  add rsp, ${finalStackSize}\n`;
        }

        assembly += '  pop rbp\n';
        assembly += '  ret\n';
      }
    }

    return assembly;
  }

  private getTypeSize(type: IRType): number {
    switch (type) {
      case IRType.I8: return 1;
      case IRType.I32: return 4;
      case IRType.I64: return 8;
      case IRType.PTR: return 8;
      case IRType.VOID: return 0;
      default: return 4;
    }
  }

  // Utility method to format the complete assembly
  formatAssembly(): string {
    let result = '';

    // Add sections
    for (const section of this.assemblyProgram.sections) {
      result += section.content + '\n';
    }

    return result;
  }
}

// Utility function to generate assembly from IR
export function generateX8664Assembly(module: IRModule): string {
  const generator = new X8664AssemblyGenerator();
  const assemblyProgram = generator.generate(module);
  return generator.formatAssembly();
}