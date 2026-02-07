export enum IROpCode {
  // Binary Operations
  ADD = 'add',
  SUB = 'sub',
  MUL = 'mul',
  DIV = 'div',
  MOD = 'mod',
  
  // Comparison Operations
  EQ = 'eq',
  NE = 'ne',
  LT = 'lt',
  LE = 'le',
  GT = 'gt',
  GE = 'ge',
  
  // Logical Operations
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  
  // Memory Operations
  LOAD = 'load',
  STORE = 'store',
  ALLOCA = 'alloca',
  
  // Control Flow
  JUMP = 'jump',
  JUMP_IF = 'jump_if',
  CALL = 'call',
  RET = 'ret',
  PHI = 'phi',
  
  // Type Conversion
  TRUNC = 'trunc',
  ZEXT = 'zext',
  SEXT = 'sext',
}

export enum IRType {
  I8 = 'i8',
  I32 = 'i32',
  I64 = 'i64',
  VOID = 'void',
  PTR = 'ptr',
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
  metadata?: { [key: string]: any };
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
  parameters: Array<{ name: string; type: IRType }>;
  body: IRBlock[];
  locals: Array<{ name: string; type: IRType }>;
}

export interface IRBlock {
  label: string;
  instructions: Array<
    | IRInstruction
    | IRLabel
    | IRJump
    | IRJumpIf
    | IRCall
    | IRRet
  >;
}

export interface IRModule {
  functions: IRFunction[];
  globals: Array<{ name: string; type: IRType; initializer?: IRConstant }>;
}

// Type utilities
export function getIRTypeSize(type: IRType): number {
  switch (type) {
    case IRType.I8: return 1;
    case IRType.I32: return 4;
    case IRType.I64: return 8;
    case IRType.PTR: return 8;
    case IRType.VOID: return 0;
    default: return 4;
  }
}

export function isPointerType(type: IRType): boolean {
  return type === IRType.PTR;
}

export function isIntegerType(type: IRType): boolean {
  return type === IRType.I8 || type === IRType.I32 || type === IRType.I64;
}

// Value creation utilities
export function createValue(id: string, type: IRType): IRValue {
  return { id, type };
}

export function createConstant(value: number, type: IRType = IRType.I32): IRConstant {
  return { value, type };
}

export function createInstruction(
  id: string,
  opcode: IROpCode,
  type: IRType,
  operands: (IRValue | IRConstant)[]
): IRInstruction {
  return { id, opcode, type, operands };
}

// Pretty printing for debugging
export function prettyPrintIR(module: IRModule): string {
  let result = '';
  
  // Print globals
  for (const global of module.globals) {
    result += `@${global.name} = global ${global.type}`;
    if (global.initializer) {
      result += ` ${global.initializer.value}`;
    }
    result += '\n';
  }
  result += '\n';
  
  // Print functions
  for (const func of module.functions) {
    result += `define ${func.returnType} @${func.name}(`;
    result += func.parameters.map(p => `${p.type} ${p.name}`).join(', ');
    result += ') {\n';
    
    // Print locals
    for (const local of func.locals) {
      result += `  %${local.name} = alloca ${local.type}\n`;
    }
    
    // Print body
    for (const block of func.body) {
      result += `\n${block.label}:\n`;
      for (const instr of block.instructions) {
        if ('id' in instr && 'opcode' in instr) {
          const op = instr as IRInstruction;
          result += `  %${op.id} = ${op.opcode} ${op.type} `;
          result += op.operands.map(operand => {
            if ('value' in operand) {
              const const_op = operand as IRConstant;
              return const_op.value.toString();
            } else {
              return '%' + (operand as IRValue).id;
            }
          }).join(', ');
          result += '\n';
        } else if ('name' in instr) {
          result += `  ; ${instr.name}\n`;
        } else if ('target' in instr) {
          result += `  jump ${instr.target}\n`;
        } else if ('condition' in instr) {
          const jump = instr as IRJumpIf;
          result += `  jump_if %${jump.condition.id}, ${jump.trueTarget}, ${jump.falseTarget}\n`;
        } else if ('callee' in instr) {
          const call = instr as IRCall;
          result += `  %${call.callee} = call ${call.callee}(`;
          result += call.args.map(arg => {
            if ('value' in arg) {
              return (arg as IRConstant).value.toString();
            } else {
              return '%' + (arg as IRValue).id;
            }
          }).join(', ');
          result += `)\n`;
        } else if ('value' in instr) {
          const ret = instr as IRRet;
          if (ret.value) {
            const val = ret.value;
            if ('value' in val) {
              result += `  ret ${(val as IRConstant).value}\n`;
            } else {
              result += `  ret %${(val as IRValue).id}\n`;
            }
          } else {
            result += `  ret void\n`;
          }
        }
      }
    }
    result += '}\n\n';
  }
  
  return result;
}