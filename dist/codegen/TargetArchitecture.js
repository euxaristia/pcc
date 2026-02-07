"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstructionSelector = exports.StackManager = exports.RegisterAllocator = exports.X8664CallingConvention = void 0;
const IR_1 = require("./IR");
// x86-64 System V ABI calling convention
exports.X8664CallingConvention = {
    argumentRegisters: [
        { name: 'rdi', number: 0, callerSave: true, argument: 0 },
        { name: 'rsi', number: 1, callerSave: true, argument: 1 },
        { name: 'rdx', number: 2, callerSave: true, argument: 2 },
        { name: 'rcx', number: 3, callerSave: true, argument: 3 },
        { name: 'r8', number: 4, callerSave: true, argument: 4 },
        { name: 'r9', number: 5, callerSave: true, argument: 5 },
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
    calleeSaveRegisters: [
        { name: 'rbx', number: 0, callerSave: false },
        { name: 'rbp', number: 1, callerSave: false },
        { name: 'r12', number: 2, callerSave: false },
        { name: 'r13', number: 3, callerSave: false },
        { name: 'r14', number: 4, callerSave: false },
        { name: 'r15', number: 5, callerSave: false },
    ],
    returnRegister: { name: 'rax', number: 0, callerSave: true },
    stackAlignment: 16,
};
class RegisterAllocator {
    allocatedRegisters = new Set();
    variableRegisters = new Map();
    callingConvention;
    constructor(callingConvention) {
        this.callingConvention = callingConvention;
    }
    allocateRegister(valueId) {
        // Simple strategy: use first available caller-save register
        for (const reg of this.callingConvention.callerSaveRegisters) {
            if (!this.allocatedRegisters.has(reg)) {
                this.allocatedRegisters.add(reg);
                this.variableRegisters.set(valueId, reg);
                return reg;
            }
        }
        return null; // No registers available
    }
    freeRegister(valueId) {
        const reg = this.variableRegisters.get(valueId);
        if (reg) {
            this.allocatedRegisters.delete(reg);
            this.variableRegisters.delete(valueId);
        }
    }
    getRegister(valueId) {
        return this.variableRegisters.get(valueId) || null;
    }
    freeAllRegisters() {
        this.allocatedRegisters.clear();
        this.variableRegisters.clear();
    }
}
exports.RegisterAllocator = RegisterAllocator;
class StackManager {
    nextOffset = 0;
    slots = new Map();
    callingConvention;
    constructor(callingConvention) {
        this.callingConvention = callingConvention;
    }
    allocateStackSpace(name, size) {
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
    getStackSlot(name) {
        return this.slots.get(name) || null;
    }
    getTotalSize() {
        return this.nextOffset;
    }
    reset() {
        this.nextOffset = 0;
        this.slots.clear();
    }
}
exports.StackManager = StackManager;
class InstructionSelector {
    registerAllocator;
    stackManager;
    callingConvention;
    constructor(callingConvention) {
        this.callingConvention = callingConvention;
        this.registerAllocator = new RegisterAllocator(callingConvention);
        this.stackManager = new StackManager(callingConvention);
    }
    selectInstructions(instruction, getValue) {
        const assembly = [];
        switch (instruction.opcode) {
            case IR_1.IROpCode.ADD:
                assembly.push(...this.selectBinaryInstruction('add', instruction, getValue));
                break;
            case IR_1.IROpCode.SUB:
                assembly.push(...this.selectBinaryInstruction('sub', instruction, getValue));
                break;
            case IR_1.IROpCode.MUL:
                assembly.push(...this.selectMultiplyInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.DIV:
                assembly.push(...this.selectDivideInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.MOD:
                assembly.push(...this.selectModuloInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.EQ:
                assembly.push(...this.selectComparisonInstruction('sete', instruction, getValue));
                break;
            case IR_1.IROpCode.NE:
                assembly.push(...this.selectComparisonInstruction('setne', instruction, getValue));
                break;
            case IR_1.IROpCode.LT:
                assembly.push(...this.selectComparisonInstruction('setl', instruction, getValue));
                break;
            case IR_1.IROpCode.LE:
                assembly.push(...this.selectComparisonInstruction('setle', instruction, getValue));
                break;
            case IR_1.IROpCode.GT:
                assembly.push(...this.selectComparisonInstruction('setg', instruction, getValue));
                break;
            case IR_1.IROpCode.GE:
                assembly.push(...this.selectComparisonInstruction('setge', instruction, getValue));
                break;
            case IR_1.IROpCode.AND:
                assembly.push(...this.selectLogicalInstruction('and', instruction, getValue));
                break;
            case IR_1.IROpCode.OR:
                assembly.push(...this.selectLogicalInstruction('or', instruction, getValue));
                break;
            case IR_1.IROpCode.NOT:
                assembly.push(...this.selectNotInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.LOAD:
                assembly.push(...this.selectLoadInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.STORE:
                assembly.push(...this.selectStoreInstruction(instruction, getValue));
                break;
            case IR_1.IROpCode.ALLOCA:
                // Stack allocation is handled differently
                break;
            default:
                throw new Error(`Unsupported IR opcode: ${instruction.opcode}`);
        }
        return assembly;
    }
    selectBinaryInstruction(mnemonic, instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for binary operation');
        }
        const assembly = [];
        // Move left operand to result register
        assembly.push(`mov ${leftStr}, ${resultReg.name}`);
        // Perform operation
        assembly.push(`${mnemonic} ${rightStr}, ${resultReg.name}`);
        return assembly;
    }
    selectMultiplyInstruction(instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for multiply');
        }
        const assembly = [];
        // Move left operand to result register
        assembly.push(`mov ${leftStr}, ${resultReg.name}`);
        // Multiply
        assembly.push(`imul ${rightStr}, ${resultReg.name}`);
        return assembly;
    }
    selectDivideInstruction(instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        // Division uses rax:rdx register pair
        const assembly = [];
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
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for divide result');
        }
        assembly.push(`mov rax, ${resultReg.name}`);
        // Restore registers
        assembly.push('pop rdx');
        assembly.push('pop rax');
        return assembly;
    }
    selectModuloInstruction(instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        // Modulo uses rax:rdx register pair, result is in rdx
        const assembly = [];
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
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for modulo result');
        }
        assembly.push(`mov rdx, ${resultReg.name}`);
        // Restore registers
        assembly.push('pop rdx');
        assembly.push('pop rax');
        return assembly;
    }
    selectComparisonInstruction(setInstr, instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        const assembly = [];
        // Compare operands
        assembly.push(`cmp ${leftStr}, ${rightStr}`);
        // Set result register based on comparison
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for comparison');
        }
        assembly.push(`xor ${resultReg.name}, ${resultReg.name}`); // Clear register
        assembly.push(`${setInstr} ${resultReg.name}`); // Set to 0 or 1
        return assembly;
    }
    selectLogicalInstruction(mnemonic, instruction, getValue) {
        const [left, right] = instruction.operands;
        const leftStr = this.getOperandString(left, getValue);
        const rightStr = this.getOperandString(right, getValue);
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for logical operation');
        }
        const assembly = [];
        // Move left operand to result register
        assembly.push(`mov ${leftStr}, ${resultReg.name}`);
        // Perform operation
        assembly.push(`${mnemonic} ${rightStr}, ${resultReg.name}`);
        return assembly;
    }
    selectNotInstruction(instruction, getValue) {
        const [operand] = instruction.operands;
        const operandStr = this.getOperandString(operand, getValue);
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for not operation');
        }
        const assembly = [];
        // Move operand to result register
        assembly.push(`mov ${operandStr}, ${resultReg.name}`);
        // Logical not: result = (operand == 0)
        assembly.push(`cmp ${resultReg.name}, 0`);
        assembly.push(`sete ${resultReg.name}`);
        return assembly;
    }
    selectLoadInstruction(instruction, getValue) {
        const [address] = instruction.operands;
        const addressStr = this.getOperandString(address, getValue);
        const resultReg = this.registerAllocator.allocateRegister(instruction.id);
        if (!resultReg) {
            throw new Error('No available registers for load');
        }
        return [`mov ${addressStr}, ${resultReg.name}`];
    }
    selectStoreInstruction(instruction, getValue) {
        const [value, address] = instruction.operands;
        const valueStr = this.getOperandString(value, getValue);
        const addressStr = this.getOperandString(address, getValue);
        return [`mov ${valueStr}, ${addressStr}`];
    }
    getOperandString(operand, getValue) {
        if ('value' in operand) {
            // Constant
            if (operand.type === IR_1.IRType.I8) {
                return `$${operand.value}`; // Immediate value
            }
            else {
                return `$${operand.value}`; // Immediate value
            }
        }
        else {
            // Value (register or memory location)
            return getValue(operand.id);
        }
    }
    // Accessors for use by the assembly generator
    getRegisterAllocator() {
        return this.registerAllocator;
    }
    getStackManager() {
        return this.stackManager;
    }
}
exports.InstructionSelector = InstructionSelector;
//# sourceMappingURL=TargetArchitecture.js.map