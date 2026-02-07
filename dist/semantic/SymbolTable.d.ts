export declare enum DataType {
    INT = "int",
    CHAR = "char",
    VOID = "void"
}
export interface Symbol {
    name: string;
    type: DataType;
    kind: 'variable' | 'function' | 'parameter';
    scopeLevel: number;
    line?: number;
    column?: number;
    returnType?: DataType;
    parameters?: Array<{
        name: string;
        type: DataType;
    }>;
}
export declare class SymbolTable {
    private symbols;
    private scopeLevel;
    enterScope(): void;
    exitScope(): void;
    declare(symbol: Symbol): void;
    lookup(name: string): Symbol | undefined;
    getCurrentScopeLevel(): number;
    getSymbolsInScope(): Symbol[];
}
//# sourceMappingURL=SymbolTable.d.ts.map