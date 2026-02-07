export enum DataType {
  INT = 'int',
  CHAR = 'char',
  VOID = 'void',
}

export interface Symbol {
  name: string;
  type: DataType;
  kind: 'variable' | 'function' | 'parameter';
  scopeLevel: number;
  line?: number;
  column?: number;
  returnType?: DataType; // For functions
  parameters?: Array<{ name: string; type: DataType }>; // For functions
}

export class SymbolTable {
  private symbols: Map<string, Symbol[]> = new Map();
  private scopeLevel: number = 0;

  enterScope(): void {
    this.scopeLevel++;
  }

  exitScope(): void {
    if (this.scopeLevel > 0) {
      this.scopeLevel--;
    }
  }

  declare(symbol: Symbol): void {
    const existingSymbols = this.symbols.get(symbol.name) || [];
    
    // Check if symbol already exists in current scope
    const inCurrentScope = existingSymbols.some(s => s.scopeLevel === this.scopeLevel);
    if (inCurrentScope) {
      throw new Error(`Symbol '${symbol.name}' already declared in current scope at line ${symbol.line}, column ${symbol.column}`);
    }

    existingSymbols.push({ ...symbol, scopeLevel: this.scopeLevel });
    this.symbols.set(symbol.name, existingSymbols);
  }

  lookup(name: string): Symbol | undefined {
    const symbols = this.symbols.get(name);
    if (!symbols) return undefined;

    // Return the symbol from the innermost scope
    return symbols
      .filter(s => s.scopeLevel <= this.scopeLevel)
      .sort((a, b) => b.scopeLevel - a.scopeLevel)[0];
  }

  getCurrentScopeLevel(): number {
    return this.scopeLevel;
  }

  getSymbolsInScope(): Symbol[] {
    const result: Symbol[] = [];
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