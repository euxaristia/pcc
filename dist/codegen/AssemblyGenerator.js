"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X8664AssemblyGenerator = void 0;
exports.generateX8664Assembly = generateX8664Assembly;
const IR_1 = require("./IR");
const TargetArchitecture_1 = require("./TargetArchitecture");
class X8664AssemblyGenerator {
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
        let prologue = `.globl ${func.name}\n`;
        prologue += `${func.name}:\n`;
        // Reset register allocator and stack manager for this function
        this.instructionSelector.getRegisterAllocator().freeAllRegisters();
        this.instructionSelector.getStackManager().reset();
        // Allocate stack space for parameters if they are moved to stack (simplified)
        for (const param of func.parameters) {
            // parameters are currently handled as locals if they are ALLOCA'd in the IR
        }
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
        assembly += '  mov rsp, rbp\n';
        if (finalStackSize > 0) {
            assembly += `  sub rsp, ${finalStackSize}\n`;
        }
        // Save callee-save registers
        for (const reg of TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters) {
            assembly += `  push ${reg.name}\n`;
        }
        // Add the already generated body
        assembly += bodyAssembly;
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
                return `[rbp - ${stackSlot.offset + this.getTypeSize(IR_1.IRType.PTR)}]`; // +8 to skip saved RBP
            }
            // Check if it's a function parameter
            const paramIndex = func.parameters.findIndex(p => p.name === valueId);
            if (paramIndex >= 0) {
                const argReg = TargetArchitecture_1.X8664CallingConvention.argumentRegisters[paramIndex];
                if (argReg) {
                    return argReg.name;
                }
            }
            return `[${valueId}]`;
        };
        for (const instr of block.instructions) {
            if ('opcode' in instr) {
                // IR instruction
                const irInstr = instr;
                // Handle special instructions
                if (irInstr.opcode === IR_1.IROpCode.ALLOCA) {
                    // Stack allocation
                    const stackSlot = this.instructionSelector.getStackManager().allocateStackSpace(irInstr.id, this.getTypeSize(irInstr.type));
                    // Register the stack location
                    const reg = this.instructionSelector.getRegisterAllocator().allocateRegister(irInstr.id);
                    if (reg) {
                        // Offset is from RBP, so it should be negative
                        // +8 to skip saved RBP
                        assembly += `  lea [rbp - ${stackSlot.offset + this.getTypeSize(IR_1.IRType.PTR)}], ${reg.name}\n`;
                    }
                    continue;
                }
                // Regular instruction
                const instrAssembly = this.instructionSelector.selectInstructions(irInstr, getValueLocation);
                assembly += instrAssembly.map(line => `  ${line}`).join('\n') + '\n';
                // Free the register for this instruction result
                if (irInstr.opcode !== IR_1.IROpCode.LOAD) {
                    this.instructionSelector.getRegisterAllocator().freeRegister(irInstr.id);
                }
            }
            else if ('target' in instr) {
                const jump = instr;
                assembly += `  jmp ${jump.target}\n`;
            }
            else if ('condition' in instr) {
                const jump = instr;
                const condLocation = getValueLocation(jump.condition.id);
                assembly += `  cmp ${condLocation}, 0\n`;
                assembly += `  jne ${jump.trueTarget}\n`;
                assembly += `  jmp ${jump.falseTarget}\n`;
            }
            else if ('callee' in instr) {
                const call = instr;
                for (const reg of TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters) {
                    assembly += `  push ${reg.name}\n`;
                }
                for (let i = 0; i < call.args.length && i < 6; i++) {
                    const arg = call.args[i];
                    const argReg = TargetArchitecture_1.X8664CallingConvention.argumentRegisters[i];
                    let argLocation = 'value' in arg ? `$${arg.value}` : getValueLocation(arg.id);
                    assembly += `  mov ${argLocation}, ${argReg.name}\n`;
                }
                assembly += `  call ${call.callee}\n`;
                for (let i = TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters.length - 1; i >= 0; i--) {
                    const reg = TargetArchitecture_1.X8664CallingConvention.callerSaveRegisters[i];
                    assembly += `  pop ${reg.name}\n`;
                }
                if (call.type !== IR_1.IRType.VOID) {
                    const resultReg = this.instructionSelector.getRegisterAllocator().allocateRegister(call.callee);
                    if (resultReg && resultReg.name !== TargetArchitecture_1.X8664CallingConvention.returnRegister.name) {
                        assembly += `  mov ${TargetArchitecture_1.X8664CallingConvention.returnRegister.name}, ${resultReg.name}\n`;
                    }
                }
            }
            else if ('value' in instr || instr.type === 'ret') {
                const ret = instr;
                if (ret.value) {
                    let retLocation = 'value' in ret.value ? `$${ret.value.value}` : getValueLocation(ret.value.id);
                    assembly += `  mov ${retLocation}, ${TargetArchitecture_1.X8664CallingConvention.returnRegister.name}\n`;
                }
                for (let i = TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters.length - 1; i >= 0; i--) {
                    const reg = TargetArchitecture_1.X8664CallingConvention.calleeSaveRegisters[i];
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
