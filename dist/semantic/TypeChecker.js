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
            if (left === right) {
                return { type: left, isError: false };
            }
            return {
                type: left,
                isError: true,
                errorMessage: `Cannot assign ${right} to ${left}`,
            };
        }
        // Arithmetic operations: both operands must be numeric
        if (['+', '-', '*', '/', '%'].includes(operator)) {
            if (left === SymbolTable_1.DataType.INT && right === SymbolTable_1.DataType.INT) {
                return { type: SymbolTable_1.DataType.INT, isError: false };
            }
            return {
                type: SymbolTable_1.DataType.INT,
                isError: true,
                errorMessage: `Invalid operands to arithmetic operator '${operator}': ${left} and ${right}`,
            };
        }
        // Comparison operations
        if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
            if (left === right && left !== SymbolTable_1.DataType.VOID) {
                return { type: SymbolTable_1.DataType.INT, isError: false }; // Comparisons return int (0 or 1)
            }
            return {
                type: SymbolTable_1.DataType.INT,
                isError: true,
                errorMessage: `Invalid operands to comparison operator '${operator}': ${left} and ${right}`,
            };
        }
        // Logical operations
        if (['&&', '||', '!'].includes(operator)) {
            return { type: SymbolTable_1.DataType.INT, isError: false }; // Logical expressions return int
        }
        return { type: left, isError: false };
    }
    checkFunctionCall(name, argTypes) {
        const signature = this.functionSignatures.get(name);
        if (!signature) {
            return {
                type: SymbolTable_1.DataType.VOID,
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
            if (expected !== actual) {
                return {
                    type: signature.returnType,
                    isError: true,
                    errorMessage: `Parameter ${i + 1} of function '${name}' expects ${expected}, got ${actual}`,
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
        if (expected === SymbolTable_1.DataType.VOID) {
            return actual === SymbolTable_1.DataType.VOID;
        }
        return expected === actual;
    }
}
exports.TypeChecker = TypeChecker;
