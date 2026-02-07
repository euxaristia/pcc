import { DataType } from './SymbolTable';

export interface TypeCheckResult {
  type: DataType;
  isError: boolean;
  errorMessage?: string;
}

export interface FunctionSignature {
  name: string;
  returnType: DataType;
  parameterTypes: DataType[];
}

export class TypeChecker {
  private functionSignatures: Map<string, FunctionSignature> = new Map();

  checkCompatible(left: DataType, right: DataType, operator: string): TypeCheckResult {
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
      if (left === DataType.INT && right === DataType.INT) {
        return { type: DataType.INT, isError: false };
      }
      return {
        type: DataType.INT,
        isError: true,
        errorMessage: `Invalid operands to arithmetic operator '${operator}': ${left} and ${right}`,
      };
    }

    // Comparison operations
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      if (left === right && left !== DataType.VOID) {
        return { type: DataType.INT, isError: false }; // Comparisons return int (0 or 1)
      }
      return {
        type: DataType.INT,
        isError: true,
        errorMessage: `Invalid operands to comparison operator '${operator}': ${left} and ${right}`,
      };
    }

    // Logical operations
    if (['&&', '||', '!'].includes(operator)) {
      return { type: DataType.INT, isError: false }; // Logical expressions return int
    }

    return { type: left, isError: false };
  }

  checkFunctionCall(name: string, argTypes: DataType[]): TypeCheckResult {
    const signature = this.functionSignatures.get(name);
    if (!signature) {
      return {
        type: DataType.VOID,
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

  declareFunction(signature: FunctionSignature): void {
    this.functionSignatures.set(signature.name, signature);
  }

  getFunctionSignature(name: string): FunctionSignature | undefined {
    return this.functionSignatures.get(name);
  }

  isValidReturnType(expected: DataType, actual: DataType): boolean {
    if (expected === DataType.VOID) {
      return actual === DataType.VOID;
    }
    return expected === actual;
  }
}