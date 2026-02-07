import { DataType, isSameType, typeToString, BuiltinTypes, BaseType } from './SymbolTable';

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
      if (isSameType(left, right)) {
        return { type: left, isError: false };
      }
      
      // Allow assignment of 0 to any pointer (null pointer)
      if (left.isPointer && right.baseType === BaseType.INT && !right.isPointer) {
        return { type: left, isError: false };
      }

      return {
        type: left,
        isError: true,
        errorMessage: `Cannot assign ${typeToString(right)} to ${typeToString(left)}`,
      };
    }

    // Arithmetic operations: both operands must be numeric
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      if (isSameType(left, BuiltinTypes.INT) && isSameType(right, BuiltinTypes.INT)) {
        return { type: BuiltinTypes.INT, isError: false };
      }
      
      // Basic pointer arithmetic: ptr + int, ptr - int
      if (left.isPointer && isSameType(right, BuiltinTypes.INT) && (operator === '+' || operator === '-')) {
        return { type: left, isError: false };
      }

      return {
        type: BuiltinTypes.INT,
        isError: true,
        errorMessage: `Invalid operands to arithmetic operator '${operator}': ${typeToString(left)} and ${typeToString(right)}`,
      };
    }

    // Comparison operations
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      if (isSameType(left, right) && left.baseType !== BaseType.VOID) {
        return { type: BuiltinTypes.INT, isError: false }; // Comparisons return int (0 or 1)
      }
      
      // Allow comparison of pointers with 0
      if (left.isPointer && isSameType(right, BuiltinTypes.INT)) {
        return { type: BuiltinTypes.INT, isError: false };
      }
      if (right.isPointer && isSameType(left, BuiltinTypes.INT)) {
        return { type: BuiltinTypes.INT, isError: false };
      }

      return {
        type: BuiltinTypes.INT,
        isError: true,
        errorMessage: `Invalid operands to comparison operator '${operator}': ${typeToString(left)} and ${typeToString(right)}`,
      };
    }

    // Logical operations
    if (['&&', '||', '!'].includes(operator)) {
      return { type: BuiltinTypes.INT, isError: false }; // Logical expressions return int
    }

    return { type: left, isError: false };
  }

  checkFunctionCall(name: string, argTypes: DataType[]): TypeCheckResult {
    const signature = this.functionSignatures.get(name);
    if (!signature) {
      return {
        type: BuiltinTypes.VOID,
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
      if (!isSameType(expected, actual)) {
        // Allow passing 0 to pointer parameter
        if (expected.isPointer && isSameType(actual, BuiltinTypes.INT)) {
          continue;
        }

        return {
          type: signature.returnType,
          isError: true,
          errorMessage: `Parameter ${i + 1} of function '${name}' expects ${typeToString(expected)}, got ${typeToString(actual)}`,
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
    if (expected.baseType === BaseType.VOID && !expected.isPointer) {
      return actual.baseType === BaseType.VOID && !actual.isPointer;
    }
    return isSameType(expected, actual);
  }
}