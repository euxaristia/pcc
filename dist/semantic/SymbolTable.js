"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolTable = exports.BuiltinTypes = exports.BaseType = void 0;
exports.isSameType = isSameType;
exports.typeToString = typeToString;
var BaseType;
(function (BaseType) {
    BaseType["INT"] = "int";
    BaseType["CHAR"] = "char";
    BaseType["VOID"] = "void";
    BaseType["STRUCT"] = "struct";
})(BaseType || (exports.BaseType = BaseType = {}));
exports.BuiltinTypes = {
    INT: { baseType: BaseType.INT, isPointer: false, pointerCount: 0 },
    CHAR: { baseType: BaseType.CHAR, isPointer: false, pointerCount: 0 },
    VOID: { baseType: BaseType.VOID, isPointer: false, pointerCount: 0 },
};
function isSameType(a, b) {
    return a.baseType === b.baseType &&
        a.isPointer === b.isPointer &&
        a.pointerCount === b.pointerCount &&
        a.structName === b.structName;
}
function typeToString(type) {
    let str = type.baseType === BaseType.STRUCT ? `struct ${type.structName}` : type.baseType;
    if (type.isPointer) {
        str += '*'.repeat(type.pointerCount);
    }
    return str;
}
class SymbolTable {
    constructor() {
        this.symbols = new Map();
        this.scopeLevel = 0;
    }
    enterScope() {
        this.scopeLevel++;
    }
    exitScope() {
        if (this.scopeLevel > 0) {
            // Remove all symbols from the current scope before exiting
            for (const [name, symbols] of this.symbols) {
                const filtered = symbols.filter(s => s.scopeLevel !== this.scopeLevel);
                if (filtered.length === 0) {
                    this.symbols.delete(name);
                }
                else {
                    this.symbols.set(name, filtered);
                }
            }
            this.scopeLevel--;
        }
    }
    declare(symbol) {
        const existingSymbols = this.symbols.get(symbol.name) || [];
        // Check if symbol already exists in current scope
        const inCurrentScope = existingSymbols.some(s => s.scopeLevel === this.scopeLevel);
        if (inCurrentScope) {
            throw new Error(`Symbol '${symbol.name}' already declared in current scope at line ${symbol.line}, column ${symbol.column}`);
        }
        existingSymbols.push({ ...symbol, scopeLevel: this.scopeLevel });
        this.symbols.set(symbol.name, existingSymbols);
    }
    lookup(name) {
        const symbols = this.symbols.get(name);
        if (!symbols)
            return undefined;
        // Return the symbol from the innermost scope
        return symbols
            .filter(s => s.scopeLevel <= this.scopeLevel)
            .sort((a, b) => b.scopeLevel - a.scopeLevel)[0];
    }
    getCurrentScopeLevel() {
        return this.scopeLevel;
    }
    getSymbolsInScope() {
        const result = [];
        for (const [name, symbols] of this.symbols) {
            for (const symbol of symbols) {
                if (symbol.scopeLevel === this.scopeLevel) {
                    result.push(symbol);
                }
            }
        }
        return result;
    }
}
exports.SymbolTable = SymbolTable;
