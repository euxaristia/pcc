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
export declare class TypeChecker {
    private functionSignatures;
    checkCompatible(left: DataType, right: DataType, operator: string): TypeCheckResult;
    checkFunctionCall(name: string, argTypes: DataType[]): TypeCheckResult;
    declareFunction(signature: FunctionSignature): void;
    getFunctionSignature(name: string): FunctionSignature | undefined;
    isValidReturnType(expected: DataType, actual: DataType): boolean;
}
//# sourceMappingURL=TypeChecker.d.ts.map