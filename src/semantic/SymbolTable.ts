export enum BaseType {
  INT = 'int',
  CHAR = 'char',
  LONG = 'long',
  FLOAT = 'float',
  DOUBLE = 'double',
  VOID = 'void',
  STRUCT = 'struct',
}

export interface DataType {
  baseType: BaseType;
  isPointer: boolean;
  pointerCount: number;
  structName?: string;
}

export const BuiltinTypes = {
  INT: { baseType: BaseType.INT, isPointer: false, pointerCount: 0 } as DataType,
  CHAR: { baseType: BaseType.CHAR, isPointer: false, pointerCount: 0 } as DataType,
  LONG: { baseType: BaseType.LONG, isPointer: false, pointerCount: 0 } as DataType,
  FLOAT: { baseType: BaseType.FLOAT, isPointer: false, pointerCount: 0 } as DataType,
  DOUBLE: { baseType: BaseType.DOUBLE, isPointer: false, pointerCount: 0 } as DataType,
  VOID: { baseType: BaseType.VOID, isPointer: false, pointerCount: 0 } as DataType,
};

export function isSameType(a: DataType, b: DataType): boolean {
  return a.baseType === b.baseType && 
         a.isPointer === b.isPointer && 
         a.pointerCount === b.pointerCount &&
         a.structName === b.structName;
}

export function typeToString(type: DataType): string {
  let str = type.baseType === BaseType.STRUCT ? `struct ${type.structName}` : type.baseType as string;
  if (type.isPointer) {
    str += '*'.repeat(type.pointerCount);
  }
  return str;
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

export interface StructMember {
  name: string;
  type: DataType;
}

export interface StructInfo {
  name: string;
  members: Map<string, StructMember>;
}

export class SymbolTable {
  private symbols: Map<string, Symbol[]> = new Map();
  private scopeLevel: number = 0;
  private structDefinitions: Map<string, StructInfo> = new Map();

  enterScope(): void {
    this.scopeLevel++;
  }

  exitScope(): void {
    if (this.scopeLevel > 0) {
      // Remove all symbols from the current scope before exiting
      for (const [name, symbols] of this.symbols) {
        const filtered = symbols.filter(s => s.scopeLevel !== this.scopeLevel);
        if (filtered.length === 0) {
          this.symbols.delete(name);
        } else {
          this.symbols.set(name, filtered);
        }
      }
      this.scopeLevel--;
    }
  }

  declare(symbol: Symbol): void {
    const existingSymbols = this.symbols.get(symbol.name) || [];
    
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

  registerStruct(info: StructInfo): void {
    this.structDefinitions.set(info.name, info);
  }

  getStruct(name: string): StructInfo | undefined {
    return this.structDefinitions.get(name);
  }
}