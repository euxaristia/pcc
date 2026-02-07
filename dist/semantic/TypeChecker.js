"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeChecker = void 0;
const SymbolTable_1 = require("./SymbolTable");
class TypeChecker {
    constructor() {
        this.functionSignatures = new Map();
    }
    checkCompatible(left, right, operator) {
        // Assignment and most binary operations require compatible types
        if (operator === '=') {
            if ((0, SymbolTable_1.isSameType)(left, right)) {
                return { type: left, isError: false };
            }
            // Allow assignment of 0 to any pointer (null pointer)
            if (left.isPointer && right.baseType === SymbolTable_1.BaseType.INT && !right.isPointer) {
                return { type: left, isError: false };
            }
            return {
                type: left,
                isError: true,
                errorMessage: `Cannot assign ${(0, SymbolTable_1.typeToString)(right)} to ${(0, SymbolTable_1.typeToString)(left)}`,
            };
        }
        // Arithmetic operations: both operands must be numeric
        if (['+', '-', '*', '/', '%'].includes(operator)) {
            if ((0, SymbolTable_1.isSameType)(left, SymbolTable_1.BuiltinTypes.INT) && (0, SymbolTable_1.isSameType)(right, SymbolTable_1.BuiltinTypes.INT)) {
                return { type: SymbolTable_1.BuiltinTypes.INT, isError: false };
            }
            // Basic pointer arithmetic: ptr + int, ptr - int
            if (left.isPointer && (0, SymbolTable_1.isSameType)(right, SymbolTable_1.BuiltinTypes.INT) && (operator === '+' || operator === '-')) {
                return { type: left, isError: false };
            }
            return {
                type: SymbolTable_1.BuiltinTypes.INT,
                isError: true,
                errorMessage: `Invalid operands to arithmetic operator '${operator}': ${(0, SymbolTable_1.typeToString)(left)} and ${(0, SymbolTable_1.typeToString)(right)}`,
            };
        }
        // Comparison operations
        if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
            if ((0, SymbolTable_1.isSameType)(left, right) && left.baseType !== SymbolTable_1.BaseType.VOID) {
                return { type: SymbolTable_1.BuiltinTypes.INT, isError: false }; // Comparisons return int (0 or 1)
            }
            // Allow comparison of pointers with 0
            if (left.isPointer && (0, SymbolTable_1.isSameType)(right, SymbolTable_1.BuiltinTypes.INT)) {
                return { type: SymbolTable_1.BuiltinTypes.INT, isError: false };
            }
            if (right.isPointer && (0, SymbolTable_1.isSameType)(left, SymbolTable_1.BuiltinTypes.INT)) {
                return { type: SymbolTable_1.BuiltinTypes.INT, isError: false };
            }
            return {
                type: SymbolTable_1.BuiltinTypes.INT,
                isError: true,
                errorMessage: `Invalid operands to comparison operator '${operator}': ${(0, SymbolTable_1.typeToString)(left)} and ${(0, SymbolTable_1.typeToString)(right)}`,
            };
        }
        // Logical operations
        if (['&&', '||', '!'].includes(operator)) {
            return { type: SymbolTable_1.BuiltinTypes.INT, isError: false }; // Logical expressions return int
        }
        return { type: left, isError: false };
    }
    checkFunctionCall(name, argTypes) {
        const signature = this.functionSignatures.get(name);
        if (!signature) {
            return {
                type: SymbolTable_1.BuiltinTypes.VOID,
                isError: true,
                errorMessage: `Function '${name}' not declared`,
            };
        }
        if (signature.parameterTypes.length !== argTypes.length) {
            return {
                type: signature.returnType,
                isError: true,
                errorMessage: `Function '${name}' expects ${signature.parameterTypes.length} arguments, got ${argTypes.length}`,
            };
        }
        for (let i = 0; i < argTypes.length; i++) {
            const expected = signature.parameterTypes[i];
            const actual = argTypes[i];
            if (!(0, SymbolTable_1.isSameType)(expected, actual)) {
                // Allow passing 0 to pointer parameter
                if (expected.isPointer && (0, SymbolTable_1.isSameType)(actual, SymbolTable_1.BuiltinTypes.INT)) {
                    continue;
                }
                return {
                    type: signature.returnType,
                    isError: true,
                    errorMessage: `Parameter ${i + 1} of function '${name}' expects ${(0, SymbolTable_1.typeToString)(expected)}, got ${(0, SymbolTable_1.typeToString)(actual)}`,
                };
            }
        }
        return { type: signature.returnType, isError: false };
    }
    declareFunction(signature) {
        this.functionSignatures.set(signature.name, signature);
    }
    getFunctionSignature(name) {
        return this.functionSignatures.get(name);
    }
    isValidReturnType(expected, actual) {
        if (expected.baseType === SymbolTable_1.BaseType.VOID && !expected.isPointer) {
            return actual.baseType === SymbolTable_1.BaseType.VOID && !actual.isPointer;
        }
        return (0, SymbolTable_1.isSameType)(expected, actual);
    }
}
exports.TypeChecker = TypeChecker;
