"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IRType = exports.IROpCode = void 0;
exports.getIRTypeSize = getIRTypeSize;
exports.isPointerType = isPointerType;
exports.isIntegerType = isIntegerType;
exports.createValue = createValue;
exports.createConstant = createConstant;
exports.createInstruction = createInstruction;
exports.prettyPrintIR = prettyPrintIR;
var IROpCode;
(function (IROpCode) {
    // Binary Operations
    IROpCode["ADD"] = "add";
    IROpCode["SUB"] = "sub";
    IROpCode["MUL"] = "mul";
    IROpCode["DIV"] = "div";
    IROpCode["MOD"] = "mod";
    // Comparison Operations
    IROpCode["EQ"] = "eq";
    IROpCode["NE"] = "ne";
    IROpCode["LT"] = "lt";
    IROpCode["LE"] = "le";
    IROpCode["GT"] = "gt";
    IROpCode["GE"] = "ge";
    // Logical Operations
    IROpCode["AND"] = "and";
    IROpCode["OR"] = "or";
    IROpCode["NOT"] = "not";
    // Memory Operations
    IROpCode["LOAD"] = "load";
    IROpCode["STORE"] = "store";
    IROpCode["ALLOCA"] = "alloca";
    // Control Flow
    IROpCode["JUMP"] = "jump";
    IROpCode["JUMP_IF"] = "jump_if";
    IROpCode["CALL"] = "call";
    IROpCode["RET"] = "ret";
    IROpCode["PHI"] = "phi";
    // Type Conversion
    IROpCode["TRUNC"] = "trunc";
    IROpCode["ZEXT"] = "zext";
    IROpCode["SEXT"] = "sext";
})(IROpCode || (exports.IROpCode = IROpCode = {}));
var IRType;
(function (IRType) {
    IRType["I8"] = "i8";
    IRType["I32"] = "i32";
    IRType["I64"] = "i64";
    IRType["VOID"] = "void";
    IRType["PTR"] = "ptr";
})(IRType || (exports.IRType = IRType = {}));
// Type utilities
function getIRTypeSize(type) {
    switch (type) {
        case IRType.I8: return 1;
        case IRType.I32: return 4;
        case IRType.I64: return 8;
        case IRType.PTR: return 8;
        case IRType.VOID: return 0;
        default: return 4;
    }
}
function isPointerType(type) {
    return type === IRType.PTR;
}
function isIntegerType(type) {
    return type === IRType.I8 || type === IRType.I32 || type === IRType.I64;
}
// Value creation utilities
function createValue(id, type) {
    return { id, type };
}
function createConstant(value, type = IRType.I32) {
    return { value, type };
}
function createInstruction(id, opcode, type, operands) {
    return { id, opcode, type, operands };
}
// Pretty printing for debugging
function prettyPrintIR(module) {
    let result = '';
    // Print globals
    for (const global of module.globals) {
        result += `@${global.name} = global ${global.type}`;
        if (global.initializer) {
            result += ` ${global.initializer.value}`;
        }
        result += '\n';
    }
    result += '\n';
    // Print functions
    for (const func of module.functions) {
        result += `define ${func.returnType} @${func.name}(`;
        result += func.parameters.map(p => `${p.type} ${p.name}`).join(', ');
        result += ') {\n';
        // Print locals
        for (const local of func.locals) {
            result += `  %${local.name} = alloca ${local.type}\n`;
        }
        // Print body
        for (const block of func.body) {
            result += `\n${block.label}:\n`;
            for (const instr of block.instructions) {
                if ('id' in instr && 'opcode' in instr) {
                    const op = instr;
                    result += `  %${op.id} = ${op.opcode} ${op.type} `;
                    result += op.operands.map(operand => {
                        if ('value' in operand) {
                            const const_op = operand;
                            return const_op.value.toString();
                        }
                        else {
                            return '%' + operand.id;
                        }
                    }).join(', ');
                    result += '\n';
                }
                else if ('name' in instr) {
                    result += `  ; ${instr.name}\n`;
                }
                else if ('target' in instr) {
                    result += `  jump ${instr.target}\n`;
                }
                else if ('condition' in instr) {
                    const jump = instr;
                    result += `  jump_if %${jump.condition.id}, ${jump.trueTarget}, ${jump.falseTarget}\n`;
                }
                else if ('callee' in instr) {
                    const call = instr;
                    result += `  %${call.callee} = call ${call.callee}(`;
                    result += call.args.map(arg => {
                        if ('value' in arg) {
                            return arg.value.toString();
                        }
                        else {
                            return '%' + arg.id;
                        }
                    }).join(', ');
                    result += `)\n`;
                }
                else if ('value' in instr) {
                    const ret = instr;
                    if (ret.value) {
                        const val = ret.value;
                        if ('value' in val) {
                            result += `  ret ${val.value}\n`;
                        }
                        else {
                            result += `  ret %${val.id}\n`;
                        }
                    }
                    else {
                        result += `  ret void\n`;
                    }
                }
            }
        }
        result += '}\n\n';
    }
    return result;
}
//# sourceMappingURL=IR.js.map