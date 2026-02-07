"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolTable = exports.DataType = void 0;
var DataType;
(function (DataType) {
    DataType["INT"] = "int";
    DataType["CHAR"] = "char";
    DataType["VOID"] = "void";
})(DataType || (exports.DataType = DataType = {}));
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
