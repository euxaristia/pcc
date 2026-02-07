"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X8664AssemblyGenerator = void 0;
exports.generateX8664Assembly = generateX8664Assembly;
const IR_1 = require("./IR");
const TargetArchitecture_1 = require("./TargetArchitecture");
class X8664AssemblyGenerator {
    instructionSelector;
    assemblyProgram;
    constructor() {
        this.instructionSelector = new TargetArchitecture_1.InstructionSelector(TargetArchitecture_1.X8664CallingConvention);
        this.assemblyProgram = {
            sections: [],
            globals: [],
        };
    }
    generate(module) {
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
    generateDataSection(globals) {
        if (globals.length === 0)
            return;
        let dataSection = '.data\n';
        for (const global of globals) {
            dataSection += `  .globl ${global.name}\n`;
            dataSection += `  ${global.name}:\n`;
            if (global.initializer !== undefined) {
                if (global.type === IR_1.IRType.I32) {
                    dataSection += `  .long ${global.initializer.value}\n`;
                }
                else if (global.type === IR_1.IRType.I8) {
                    dataSection += `  .byte ${global.initializer.value}\n`;
                }
                else if (global.type === IR_1.IRType.I64) {
                    dataSection += `  .quad ${global.initializer.value}\n`;
                }
            }
            else {
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
    generateTextSection(functions) {
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
    generateFunction(func) {
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
        for (const reg of TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters) {
            assembly += `  push ${reg.name}\n`;
        }
        // Generate function body
        for (const block of func.body) {
            assembly += this.generateBlock(block, func);
        }
        return assembly;
    }
    generateBlock(block, func) {
        let assembly = `${block.label}:\n`;
        // Map value IDs to their location (register or stack)
        const getValueLocation = (valueId) => {
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
                const argReg = TargetArchitecture_1.X8664CallingConvention.argumentRegisters[paramIndex];
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
                const irInstr = instr;
                // Handle special instructions
                if (irInstr.opcode === IR_1.IROpCode.ALLOCA) {
                    // Stack allocation - allocate space for the variable
                    const stackSlot = this.instructionSelector.getStackManager().allocateStackSpace(irInstr.id, this.getTypeSize(irInstr.type));
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
                if (irInstr.opcode !== IR_1.IROpCode.LOAD && irInstr.opcode !== IR_1.IROpCode.ALLOCA) {
                    this.instructionSelector.getRegisterAllocator().freeRegister(irInstr.id);
                }
            }
            else if ('target' in instr) {
                // Unconditional jump
                const jump = instr;
                assembly += `  jmp ${jump.target}\n`;
            }
            else if ('condition' in instr) {
                // Conditional jump
                const jump = instr;
                const condLocation = getValueLocation(jump.condition.id);
                assembly += `  cmp ${condLocation}, 0\n`;
                assembly += `  jne ${jump.trueTarget}\n`;
                assembly += `  jmp ${jump.falseTarget}\n`;
            }
            else if ('callee' in instr) {
                // Function call
                const call = instr;
                // Save caller-save registers
                for (const reg of TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters) {
                    assembly += `  push ${reg.name}\n`;
                }
                // Setup arguments
                for (let i = 0; i < call.args.length && i < 6; i++) {
                    const arg = call.args[i];
                    const argReg = TargetArchitecture_1.X8664CallingConvention.argumentRegisters[i];
                    let argLocation;
                    if ('value' in arg) {
                        argLocation = `$${arg.value}`;
                    }
                    else {
                        argLocation = getValueLocation(arg.id);
                    }
                    assembly += `  mov ${argLocation}, ${argReg.name}\n`;
                }
                // Extra arguments go on stack (not implemented yet)
                // Make the call
                assembly += `  call ${call.callee}\n`;
                // Restore caller-save registers
                for (let i = TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters.length - 1; i >= 0; i--) {
                    const reg = TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters[i];
                    assembly += `  pop ${reg.name}\n`;
                }
                // Move return value to result register if needed
                if (call.type !== IR_1.IRType.VOID) {
                    const resultReg = this.instructionSelector.getRegisterAllocator().allocateRegister(call.callee);
                    if (resultReg && resultReg.name !== TargetArchitecture_1.X8664CallingConvention.returnRegister.name) {
                        assembly += `  mov ${TargetArchitecture_1.X8664CallingConvention.returnRegister.name}, ${resultReg.name}\n`;
                    }
                }
            }
            else if ('value' in instr || instr.type === 'ret') {
                // Return instruction
                const ret = instr;
                if (ret.value) {
                    let retLocation;
                    if ('value' in ret.value) {
                        retLocation = `$${ret.value.value}`;
                    }
                    else {
                        retLocation = getValueLocation(ret.value.id);
                    }
                    assembly += `  mov ${retLocation}, ${TargetArchitecture_1.X8664CallingConvention.returnRegister.name}\n`;
                }
                // Function epilogue
                // Restore callee-save registers
                for (let i = TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters.length - 1; i >= 0; i--) {
                    const reg = TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters[i];
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
    getTypeSize(type) {
        switch (type) {
            case IR_1.IRType.I8: return 1;
            case IR_1.IRType.I32: return 4;
            case IR_1.IRType.I64: return 8;
            case IR_1.IRType.PTR: return 8;
            case IR_1.IRType.VOID: return 0;
            default: return 4;
        }
    }
    // Utility method to format the complete assembly
    formatAssembly() {
        let result = '';
        // Add sections
        for (const section of this.assemblyProgram.sections) {
            result += section.content + '\n';
        }
        return result;
    }
}
exports.X8664AssemblyGenerator = X8664AssemblyGenerator;
// Utility function to generate assembly from IR
function generateX8664Assembly(module) {
    const generator = new X8664AssemblyGenerator();
    const assemblyProgram = generator.generate(module);
    return generator.formatAssembly();
}
//# sourceMappingURL=AssemblyGenerator.js.map