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

  private isNumeric(type: DataType): boolean {
    return !type.isPointer && [BaseType.INT, BaseType.CHAR, BaseType.LONG, BaseType.FLOAT, BaseType.DOUBLE].includes(type.baseType);
  }

  private isFloatingPoint(type: DataType): boolean {
    return !type.isPointer && [BaseType.FLOAT, BaseType.DOUBLE].includes(type.baseType);
  }

  private getPromotedType(left: DataType, right: DataType): DataType {
    if (left.baseType === BaseType.DOUBLE || right.baseType === BaseType.DOUBLE) return BuiltinTypes.DOUBLE;
    if (left.baseType === BaseType.FLOAT || right.baseType === BaseType.FLOAT) return BuiltinTypes.FLOAT;
    if (left.baseType === BaseType.LONG || right.baseType === BaseType.LONG) return BuiltinTypes.LONG;
    return BuiltinTypes.INT;
  }

  checkCompatible(left: DataType, right: DataType, operator: string): TypeCheckResult {
    // Assignment
    if (operator === '=') {
      if (isSameType(left, right)) {
        return { type: left, isError: false };
      }
      
      // Allow implicit conversions between numeric types
      if (this.isNumeric(left) && this.isNumeric(right)) {
        return { type: left, isError: false };
      }

      // Allow assignment of int to unsigned types (common in kernel code)
      if (left.baseType === BaseType.LONG && right.baseType === BaseType.INT && !right.isPointer) {
        return { type: left, isError: false };
      }

      // Allow void* to any pointer and vice versa
      if ((left.isPointer && right.isPointer) && (left.baseType === BaseType.VOID || right.baseType === BaseType.VOID)) {
        return { type: left, isError: false };
      }

      // Allow assignment of functions to function pointers
      if (left.isPointer && !right.isPointer && right.baseType === BaseType.VOID) {
        return { type: left, isError: false };
      }

      // Allow assignment of 0 to any pointer (null pointer)
      if (left.isPointer && right.baseType === BaseType.INT && !right.isPointer) {
        return { type: left, isError: false };
      }

      // Allow assignment between struct pointers (C allows this for compatible struct types)
      if (left.isPointer && right.isPointer && left.baseType === BaseType.STRUCT && right.baseType === BaseType.STRUCT) {
        return { type: left, isError: false };
      }

      // Allow assignment between struct values (for member access where we can't resolve the exact type)
      if (!left.isPointer && !right.isPointer && left.baseType === BaseType.STRUCT && right.baseType === BaseType.STRUCT) {
        return { type: left, isError: false };
      }

      // Allow assignment from struct pointer to struct value (common in kernel code patterns)
      if (!left.isPointer && right.isPointer && right.baseType === BaseType.STRUCT) {
        return { type: left, isError: false };
      }

      // Allow assignment from struct value to struct pointer
      if (left.isPointer && !right.isPointer && left.baseType === BaseType.STRUCT) {
        return { type: left, isError: false };
      }

      // Allow assigning 0 to struct pointer (null pointer)
      if (left.isPointer && left.baseType === BaseType.STRUCT && right.baseType === BaseType.INT) {
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
      if (this.isNumeric(left) && this.isNumeric(right)) {
        // Result is the promoted type
        return { type: this.getPromotedType(left, right), isError: false };
      }
      
      // Basic pointer arithmetic: ptr + int, ptr - int
      if (left.isPointer && this.isNumeric(right) && !this.isFloatingPoint(right) && (operator === '+' || operator === '-')) {
        return { type: left, isError: false };
      }

      return {
        type: BuiltinTypes.INT,
        isError: true,
        errorMessage: `Invalid operands to arithmetic operator '${operator}': ${typeToString(left)} and ${typeToString(right)}`,
      };
    }
    
    // Bitwise operations: |, &, ^, <<, >>
    if (['|', '&', '^', '<<', '>>'].includes(operator)) {
      if (this.isNumeric(left) && this.isNumeric(right)) {
        // Result is the promoted type
        return { type: this.getPromotedType(left, right), isError: false };
      }
      return {
        type: BuiltinTypes.INT,
        isError: true,
        errorMessage: `Invalid operands to bitwise operator '${operator}': ${typeToString(left)} and ${typeToString(right)}`,
      };
    }

    // Comparison operations
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      if (this.isNumeric(left) && this.isNumeric(right)) {
        return { type: BuiltinTypes.INT, isError: false }; // Comparisons return int (0 or 1)
      }
      
      if (isSameType(left, right) && left.baseType !== BaseType.VOID) {
        return { type: BuiltinTypes.INT, isError: false };
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

  checkUnary(operand: DataType, operator: string): TypeCheckResult {
    if (['++', '--', '++_post', '--_post'].includes(operator)) {
      if (this.isNumeric(operand) || operand.isPointer) {
        return { type: operand, isError: false };
      }
      return {
        type: operand,
        isError: true,
        errorMessage: `Unary operator '${operator}' cannot be applied to ${typeToString(operand)}`,
      };
    }

    if (operator === '!') {
      return { type: BuiltinTypes.INT, isError: false };
    }

    if (operator === '~' || operator === '-') {
      if (this.isNumeric(operand)) {
        return { type: operand, isError: false };
      }
      return {
        type: operand,
        isError: true,
        errorMessage: `Unary operator '${operator}' cannot be applied to ${typeToString(operand)}`,
      };
    }

    return { type: operand, isError: false };
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

        // Allow void* to any pointer and vice versa
        if ((expected.isPointer && actual.isPointer) && (expected.baseType === BaseType.VOID || actual.baseType === BaseType.VOID)) {
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