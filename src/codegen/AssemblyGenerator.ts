import {
  IRModule, IRFunction, IRBlock, IRInstruction, IRValue, IRConstant,
  IRJump, IRJumpIf, IRCall, IRRet, IROpCode, IRType
} from './IR';
import {
  X8664CallingConvention, InstructionSelector, RegisterAllocator, StackManager
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

  constructor() {
    this.instructionSelector = new InstructionSelector(X8664CallingConvention);
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

  private generateDataSection(globals: Array<{ name: string; type: IRType; initializer?: IRConstant }>): void {
    if (globals.length === 0) return;

    let dataSection = '.data\n';
    
    for (const global of globals) {
      dataSection += `  .globl ${global.name}\n`;
      dataSection += `  ${global.name}:\n`;
      
      if (global.initializer !== undefined) {
        if (global.type === IRType.I32) {
          dataSection += `  .long ${global.initializer.value}\n`;
        } else if (global.type === IRType.I8) {
          dataSection += `  .byte ${global.initializer.value}\n`;
        } else if (global.type === IRType.I64) {
          dataSection += `  .quad ${global.initializer.value}\n`;
        }
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
    let assembly = `.globl ${func.name}\n`;
    assembly += `${func.name}:\n`;

    // Reset register allocator and stack manager for this function
    this.instructionSelector.getRegisterAllocator().freeAllRegisters();
    this.instructionSelector.getStackManager().reset();

    // Allocate stack space for locals
    let stackSize = 0;
    for (const local of func.locals) {
      const size = this.getTypeSize(local.type);
      this.instructionSelector.getStackManager().allocateStackSpace(local.name, size);
    }
    stackSize = this.instructionSelector.getStackManager().getTotalSize();

    // Function prologue
    assembly += '  push rbp\n';
    assembly += '  mov rsp, rbp\n';
    
    // Allocate stack space for locals
    if (stackSize > 0) {
      assembly += `  sub rsp, ${stackSize}\n`;
    }

    // Save callee-save registers if needed
    for (const reg of X8664CallingConvention.calleeSaveRegisters) {
      assembly += `  push ${reg.name}\n`;
    }

    // Generate function body
    for (const block of func.body) {
      assembly += this.generateBlock(block, func);
    }

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
        return `[rbp - ${stackSlot.offset}]`;
      }

      // Check if it's a function parameter
      const paramIndex = func.parameters.findIndex(p => p.name === valueId);
      if (paramIndex >= 0) {
        const argReg = X8664CallingConvention.argumentRegisters[paramIndex];
        if (argReg) {
          return argReg.name;
        }
      }

      // Check if it's a global variable (check globals from module)
      // For now, assume unknown identifiers are globals
      return `[${valueId}]`;
    };

    for (const instr of block.instructions) {
      if ('opcode' in instr) {
        // IR instruction
        const irInstr = instr as IRInstruction;
        
        // Handle special instructions
        if (irInstr.opcode === IROpCode.ALLOCA) {
          // Stack allocation - allocate space for the variable
          const stackSlot = this.instructionSelector.getStackManager().allocateStackSpace(
            irInstr.id,
            this.getTypeSize(irInstr.type)
          );
          // Register the stack location
          const reg = this.instructionSelector.getRegisterAllocator().allocateRegister(irInstr.id);
          if (reg) {
            assembly += `  lea [rbp - ${stackSlot.offset}], ${reg.name}\n`;
          }
          continue;
        }

        // Regular instruction
        const instrAssembly = this.instructionSelector.selectInstructions(irInstr, getValueLocation);
        assembly += instrAssembly.map(line => `  ${line}`).join('\n') + '\n';
        
        // Free the register for this instruction result
        if (irInstr.opcode !== IROpCode.LOAD && irInstr.opcode !== (IROpCode.ALLOCA as any)) {
          this.instructionSelector.getRegisterAllocator().freeRegister(irInstr.id);
        }
      } else if ('target' in instr) {
        // Unconditional jump
        const jump = instr as IRJump;
        assembly += `  jmp ${jump.target}\n`;
      } else if ('condition' in instr) {
        // Conditional jump
        const jump = instr as IRJumpIf;
        const condLocation = getValueLocation(jump.condition.id);
        assembly += `  cmp ${condLocation}, 0\n`;
        assembly += `  jne ${jump.trueTarget}\n`;
        assembly += `  jmp ${jump.falseTarget}\n`;
      } else if ('callee' in instr) {
        // Function call
        const call = instr as IRCall;
        
        // Save caller-save registers
        for (const reg of X8664CallingConvention.callerSaveRegisters) {
          assembly += `  push ${reg.name}\n`;
        }

        // Setup arguments
        for (let i = 0; i < call.args.length && i < 6; i++) {
          const arg = call.args[i];
          const argReg = X8664CallingConvention.argumentRegisters[i];
          
          let argLocation: string;
          if ('value' in arg) {
            argLocation = `$${arg.value}`;
          } else {
            argLocation = getValueLocation(arg.id);
          }
          
          assembly += `  mov ${argLocation}, ${argReg.name}\n`;
        }

        // Extra arguments go on stack (not implemented yet)

        // Make the call
        assembly += `  call ${call.callee}\n`;

        // Restore caller-save registers
        for (let i = X8664CallingConvention.callerSaveRegisters.length - 1; i >= 0; i--) {
          const reg = X8664CallingConvention.callerSaveRegisters[i];
          assembly += `  pop ${reg.name}\n`;
        }

        // Move return value to result register if needed
        if (call.type !== IRType.VOID) {
          const resultReg = this.instructionSelector.getRegisterAllocator().allocateRegister(call.callee);
          if (resultReg && resultReg.name !== X8664CallingConvention.returnRegister.name) {
            assembly += `  mov ${X8664CallingConvention.returnRegister.name}, ${resultReg.name}\n`;
          }
        }
      } else if ('value' in instr || (instr as any).type === 'ret') {
        // Return instruction
        const ret = instr as IRRet;
        
        if (ret.value) {
          let retLocation: string;
          if ('value' in ret.value) {
            retLocation = `$${ret.value.value}`;
          } else {
            retLocation = getValueLocation(ret.value.id);
          }
          assembly += `  mov ${retLocation}, ${X8664CallingConvention.returnRegister.name}\n`;
        }

        // Function epilogue
        // Restore callee-save registers
        for (let i = X8664CallingConvention.calleeSaveRegisters.length - 1; i >= 0; i--) {
          const reg = X8664CallingConvention.calleeSaveRegisters[i];
          assembly += `  pop ${reg.name}\n`;
        }

        // Deallocate stack space
        const stackSize = this.instructionSelector.getStackManager().getTotalSize();
        if (stackSize > 0) {
          assembly += `  add rsp, ${stackSize}\n`;
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