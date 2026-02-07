export declare enum IROpCode {
    ADD = "add",
    SUB = "sub",
    MUL = "mul",
    DIV = "div",
    MOD = "mod",
    EQ = "eq",
    NE = "ne",
    LT = "lt",
    LE = "le",
    GT = "gt",
    GE = "ge",
    AND = "and",
    OR = "or",
    NOT = "not",
    LOAD = "load",
    STORE = "store",
    ALLOCA = "alloca",
    JUMP = "jump",
    JUMP_IF = "jump_if",
    CALL = "call",
    RET = "ret",
    PHI = "phi",
    TRUNC = "trunc",
    ZEXT = "zext",
    SEXT = "sext"
}
export declare enum IRType {
    I8 = "i8",
    I32 = "i32",
    I64 = "i64",
    VOID = "void",
    PTR = "ptr"
}
export interface IRValue {
    id: string;
    type: IRType;
}
export interface IRConstant {
    value: number;
    type: IRType;
}
export interface IRInstruction {
    id: string;
    opcode: IROpCode;
    type: IRType;
    operands: (IRValue | IRConstant)[];
    metadata?: {
        [key: string]: any;
    };
}
export interface IRLabel {
    name: string;
}
export interface IRJump {
    target: string;
}
export interface IRJumpIf {
    condition: IRValue;
    trueTarget: string;
    falseTarget: string;
}
export interface IRCall {
    callee: string;
    args: (IRValue | IRConstant)[];
    type: IRType;
}
export interface IRRet {
    value?: IRValue | IRConstant;
    type: IRType;
}
export interface IRFunction {
    name: string;
    returnType: IRType;
    parameters: Array<{
        name: string;
        type: IRType;
    }>;
    body: IRBlock[];
    locals: Array<{
        name: string;
        type: IRType;
    }>;
}
export interface IRBlock {
    label: string;
    instructions: Array<IRInstruction | IRLabel | IRJump | IRJumpIf | IRCall | IRRet>;
}
export interface IRModule {
    functions: IRFunction[];
    globals: Array<{
        name: string;
        type: IRType;
        initializer?: IRConstant;
    }>;
}
export declare function getIRTypeSize(type: IRType): number;
export declare function isPointerType(type: IRType): boolean;
export declare function isIntegerType(type: IRType): boolean;
export declare function createValue(id: string, type: IRType): IRValue;
export declare function createConstant(value: number, type?: IRType): IRConstant;
export declare function createInstruction(id: string, opcode: IROpCode, type: IRType, operands: (IRValue | IRConstant)[]): IRInstruction;
export declare function prettyPrintIR(module: IRModule): string;
//# sourceMappingURL=IR.d.ts.map