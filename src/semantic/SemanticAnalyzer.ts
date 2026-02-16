import { 
  ASTNode, NodeType, ProgramNode, FunctionDeclarationNode, 
  DeclarationNode, AssignmentNode, IfStatementNode, WhileStatementNode,
  ForStatementNode, ReturnStatementNode, ExpressionStatementNode,
  BinaryExpressionNode, UnaryExpressionNode, FunctionCallNode,
  IdentifierNode, NumberLiteralNode, StringLiteralNode, CharacterLiteralNode,
  TypeSpecifierNode, ParameterNode, CompoundStatementNode, SizeofExpressionNode,
  CastExpressionNode, MemberAccessNode, ArrayAccessNode, ExpressionNode, StatementNode,
  MultiDeclarationNode, InitializerListNode, StructDeclarationNode
} from '../parser/Parser';
import { SymbolTable, Symbol, DataType, BaseType, BuiltinTypes, typeToString, isSameType, StructInfo, StructMember } from './SymbolTable';
import { TypeChecker } from './TypeChecker';

export interface SemanticError {
  message: string;
  line?: number;
  column?: number;
  node?: ASTNode;
}

export class SemanticAnalyzer {
  private symbolTable: SymbolTable;
  private typeChecker: TypeChecker;
  private errors: SemanticError[] = [];
  private currentFunction: FunctionDeclarationNode | null = null;

  constructor() {
    this.symbolTable = new SymbolTable();
    this.typeChecker = new TypeChecker();
    
    // Declare built-in functions
    this.declareBuiltinFunctions();
  }
  
  private declareBuiltinFunctions(): void {
    // __builtin_expect(exp, c) - returns exp (branch hint)
    this.typeChecker.declareFunction({
      name: '__builtin_expect',
      returnType: BuiltinTypes.INT,
      parameterTypes: [BuiltinTypes.INT, BuiltinTypes.INT],
    });
    
    // __builtin_return_address(n) - returns return address
    this.typeChecker.declareFunction({
      name: '__builtin_return_address',
      returnType: { ...BuiltinTypes.VOID, isPointer: true },
      parameterTypes: [BuiltinTypes.INT],
    });
    
    // __builtin_frame_address(n) - returns frame address
    this.typeChecker.declareFunction({
      name: '__builtin_frame_address',
      returnType: { ...BuiltinTypes.VOID, isPointer: true },
      parameterTypes: [BuiltinTypes.INT],
    });
    
    // __builtin_prefetch(addr, rw, locality) - prefetch memory
    this.typeChecker.declareFunction({
      name: '__builtin_prefetch',
      returnType: BuiltinTypes.VOID,
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, BuiltinTypes.INT, BuiltinTypes.INT],
    });
    
    // __builtin_trap() - generates a breakpoint/trap
    this.typeChecker.declareFunction({
      name: '__builtin_trap',
      returnType: BuiltinTypes.VOID,
      parameterTypes: [],
    });
    
    // __builtin_debugtrap() - generates a debug trap
    this.typeChecker.declareFunction({
      name: '__builtin_debugtrap',
      returnType: BuiltinTypes.VOID,
      parameterTypes: [],
    });
    
    // __builtin_memcpy, __builtin_memmove, etc.
    this.typeChecker.declareFunction({
      name: '__builtin_memcpy',
      returnType: { ...BuiltinTypes.VOID, isPointer: true },
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, { ...BuiltinTypes.VOID, isPointer: true }, BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: '__builtin_memset',
      returnType: { ...BuiltinTypes.VOID, isPointer: true },
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, BuiltinTypes.INT, BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: '__builtin_memchr',
      returnType: { ...BuiltinTypes.VOID, isPointer: true },
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, BuiltinTypes.INT, BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: '__builtin_strlen',
      returnType: BuiltinTypes.INT,
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }],
    });
    
    this.typeChecker.declareFunction({
      name: '__builtin_strcmp',
      returnType: BuiltinTypes.INT,
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, { ...BuiltinTypes.VOID, isPointer: true }],
    });
    
    // __builtin_va_start, __builtin_va_end, etc. for variadic functions
    this.typeChecker.declareFunction({
      name: '__builtin_va_start',
      returnType: BuiltinTypes.VOID,
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }, BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: '__builtin_va_end',
      returnType: BuiltinTypes.VOID,
      parameterTypes: [{ ...BuiltinTypes.VOID, isPointer: true }],
    });
    
    // __builtin_offsetof(type, member) - returns offset of member
    this.typeChecker.declareFunction({
      name: '__builtin_offsetof',
      returnType: BuiltinTypes.INT,
      parameterTypes: [BuiltinTypes.INT, BuiltinTypes.INT], // Simplified
    });
    
    // Common kernel macros as builtins
    this.typeChecker.declareFunction({
      name: 'BIT',
      returnType: BuiltinTypes.LONG,
      parameterTypes: [BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: 'min',
      returnType: BuiltinTypes.INT,
      parameterTypes: [BuiltinTypes.INT, BuiltinTypes.INT],
    });
    
    this.typeChecker.declareFunction({
      name: 'max',
      returnType: BuiltinTypes.INT,
      parameterTypes: [BuiltinTypes.INT, BuiltinTypes.INT],
    });
  }

  analyze(node: ASTNode): SemanticError[] {
    this.errors = [];
    this.symbolTable.enterScope(); // Global scope

    if (node.type === NodeType.PROGRAM) {
      this.analyzeProgram(node as ProgramNode);
    }

    this.symbolTable.exitScope(); // Exit global scope
    return this.errors;
  }

  private analyzeProgram(node: ProgramNode): void {
    // First pass: declare all functions
    for (const declaration of node.declarations) {
      if (declaration.type === NodeType.FUNCTION_DECLARATION) {
        this.declareFunction(declaration as FunctionDeclarationNode);
      }
    }

    // Second pass: analyze all declarations
    for (const declaration of node.declarations) {
      if (declaration.type === NodeType.FUNCTION_DECLARATION) {
        this.analyzeFunctionDeclaration(declaration as FunctionDeclarationNode);
      } else if (declaration.type === NodeType.DECLARATION) {
        this.analyzeVariableDeclaration(declaration as DeclarationNode);
      } else if (declaration.type === NodeType.MULTI_DECLARATION) {
        (declaration as MultiDeclarationNode).declarations.forEach(decl => {
          this.analyzeVariableDeclaration(decl);
        });
      } else if (declaration.type === NodeType.STRUCT_DECLARATION || declaration.type === NodeType.UNION_DECLARATION || declaration.type === NodeType.ENUM_DECLARATION) {
        // Skip type definitions for now, or we could register them in a type table
      } else if (declaration.type === NodeType.ATTRIBUTE_STMT) {
        // Skip attributes
      }
    }
  }

  private declareFunction(node: FunctionDeclarationNode): void {
    const returnType = this.parseDataType(node.returnType);
    const parameterTypes: Array<{ name: string; type: DataType }> = [];

    for (const param of node.parameters) {
      const paramType = this.parseDataType(param.varType);
      parameterTypes.push({ name: param.name, type: paramType });
    }

    const symbol: Symbol = {
      name: node.name,
      type: returnType,
      kind: 'function',
      scopeLevel: this.symbolTable.getCurrentScopeLevel(),
      line: node.line,
      column: node.column,
      returnType,
      parameters: parameterTypes,
    };

    try {
      this.symbolTable.declare(symbol);
      this.typeChecker.declareFunction({
        name: node.name,
        returnType,
        parameterTypes: parameterTypes.map(p => p.type),
      });
    } catch (error) {
      this.errors.push({
        message: (error as Error).message,
        line: node.line,
        column: node.column,
        node,
      });
    }
  }

  private analyzeFunctionDeclaration(node: FunctionDeclarationNode): void {
    this.currentFunction = node;
    this.symbolTable.enterScope(); // Function scope

    // Declare parameters
    for (const param of node.parameters) {
      const paramType = this.parseDataType(param.varType);
      const symbol: Symbol = {
        name: param.name,
        type: paramType,
        kind: 'parameter',
        scopeLevel: this.symbolTable.getCurrentScopeLevel(),
        line: param.line,
        column: param.column,
      };

      try {
        this.symbolTable.declare(symbol);
      } catch (error) {
        this.errors.push({
          message: (error as Error).message,
          line: param.line,
          column: param.column,
          node: param,
        });
      }
    }

    // Analyze function body if present
    if (node.body) {
      this.analyzeCompoundStatement(node.body);
    }

    this.symbolTable.exitScope(); // Exit function scope
    this.currentFunction = null;
  }

  private analyzeVariableDeclaration(node: DeclarationNode): void {
    const varType = this.parseDataType(node.varType);
    const symbol: Symbol = {
      name: node.name,
      type: varType,
      kind: 'variable',
      scopeLevel: this.symbolTable.getCurrentScopeLevel(),
      line: node.line,
      column: node.column,
    };

    try {
      this.symbolTable.declare(symbol);
    } catch (error) {
      this.errors.push({
        message: (error as Error).message,
        line: node.line,
        column: node.column,
        node,
      });
    }

    // Analyze initializer if present
    if (node.initializer) {
      const result = this.analyzeExpression(node.initializer, varType);
      if (!result.isError && !isSameType(result.type, varType)) {
        // Allow initialization of pointer with 0
        if (varType.isPointer && isSameType(result.type, BuiltinTypes.INT)) {
          // OK
        } else if (varType.baseType === BaseType.LONG && result.type.baseType === BaseType.INT) {
          // Allow int to long conversion
        } else {
          this.errors.push({
            message: `Cannot initialize ${typeToString(varType)} variable '${node.name}' with value of type ${typeToString(result.type)}`,
            line: node.line,
            column: node.column,
            node,
          });
        }
      }
      if (result.errorMessage) {
        this.errors.push({
          message: result.errorMessage,
          line: node.line,
          column: node.column,
          node: node.initializer,
        });
      }
    }
  }

  private analyzeCompoundStatement(node: CompoundStatementNode): void {
    this.symbolTable.enterScope(); // Block scope

    for (const statement of node.statements) {
      this.analyzeStatement(statement as StatementNode);
    }

    this.symbolTable.exitScope(); // Exit block scope
  }

  private analyzeStatement(node: StatementNode): void {
    switch (node.type) {
      case NodeType.DECLARATION:
        this.analyzeVariableDeclaration(node as DeclarationNode);
        break;

      case NodeType.MULTI_DECLARATION:
        (node as MultiDeclarationNode).declarations.forEach(decl => {
          this.analyzeVariableDeclaration(decl);
        });
        break;

      case NodeType.STRUCT_DECLARATION:
      case NodeType.UNION_DECLARATION:
      case NodeType.ENUM_DECLARATION:
        // Type definitions are handled during second pass or ignored if local
        break;

      case NodeType.EMPTY_STATEMENT:
        break;

      case NodeType.ASSIGNMENT:
        this.analyzeAssignmentStatement(node as AssignmentNode);
        break;

      case NodeType.IF_STATEMENT:
        this.analyzeIfStatement(node as IfStatementNode);
        break;

      case NodeType.WHILE_STATEMENT:
        this.analyzeWhileStatement(node as WhileStatementNode);
        break;

      case NodeType.FOR_STATEMENT:
        this.analyzeForStatement(node as ForStatementNode);
        break;

      case NodeType.RETURN_STATEMENT:
        this.analyzeReturnStatement(node as ReturnStatementNode);
        break;

      case NodeType.EXPRESSION_STATEMENT:
        this.analyzeExpressionStatement(node as ExpressionStatementNode);
        break;

      case NodeType.COMPOUND_STATEMENT:
        this.analyzeCompoundStatement(node as CompoundStatementNode);
        break;
    }
  }

  private analyzeAssignmentStatement(node: AssignmentNode): void {
    // Just delegate to the expression analyzer to avoid duplicate error reporting
    this.analyzeExpression(node);
  }

  private analyzeIfStatement(node: IfStatementNode): void {
    const conditionResult = this.analyzeExpression(node.condition);
    if (conditionResult.errorMessage) {
      this.errors.push({
        message: `Invalid if condition: ${conditionResult.errorMessage}`,
        line: node.line,
        column: node.column,
        node: node.condition,
      });
    }

    this.analyzeStatement(node.thenBranch as StatementNode);
    if (node.elseBranch) {
      this.analyzeStatement(node.elseBranch as StatementNode);
    }
  }

  private analyzeWhileStatement(node: WhileStatementNode): void {
    const conditionResult = this.analyzeExpression(node.condition);
    if (conditionResult.errorMessage) {
      this.errors.push({
        message: `Invalid while condition: ${conditionResult.errorMessage}`,
        line: node.line,
        column: node.column,
        node: node.condition,
      });
    }

    this.analyzeStatement(node.body as StatementNode);
  }

  private analyzeForStatement(node: ForStatementNode): void {
    // Analyze initialization
      if (node.initialization) {
        if (node.initialization.type === NodeType.DECLARATION) {
          this.analyzeVariableDeclaration(node.initialization as DeclarationNode);
        } else {
          this.analyzeExpressionStatement(node.initialization as ExpressionStatementNode);
        }
      }

    // Analyze condition
    if (node.condition) {
      const conditionResult = this.analyzeExpression(node.condition);
      if (conditionResult.errorMessage) {
        this.errors.push({
          message: `Invalid for condition: ${conditionResult.errorMessage}`,
          line: node.line,
          column: node.column,
          node: node.condition,
        });
      }
    }

    // Analyze increment
    if (node.increment) {
      const result = this.analyzeExpression(node.increment);
      if (result.errorMessage) {
        this.errors.push({
          message: `Invalid for increment: ${result.errorMessage}`,
          line: node.line,
          column: node.column,
          node: node.increment,
        });
      }
    }

    this.analyzeStatement(node.body as StatementNode);
  }

  private analyzeReturnStatement(node: ReturnStatementNode): void {
    if (!this.currentFunction) {
      this.errors.push({
        message: 'Return statement outside of function',
        line: node.line,
        column: node.column,
        node,
      });
      return;
    }

    const expectedType = this.parseDataType(this.currentFunction.returnType);

    if (node.value) {
      const result = this.analyzeExpression(node.value);
      if (result.isError) {
        this.errors.push({
          message: `Invalid return value: ${result.errorMessage}`,
          line: node.line,
          column: node.column,
          node: node.value,
        });
      } else if (!this.typeChecker.isValidReturnType(expectedType, result.type)) {
        this.errors.push({
          message: `Function '${this.currentFunction.name}' expects to return ${typeToString(expectedType)}, but got ${typeToString(result.type)}`,
          line: node.line,
          column: node.column,
          node,
        });
      }
    } else {
      if (expectedType.baseType !== BaseType.VOID || expectedType.isPointer) {
        this.errors.push({
          message: `Function '${this.currentFunction.name}' expects to return ${typeToString(expectedType)}, but got no value`,
          line: node.line,
          column: node.column,
          node,
        });
      }
    }
  }

  private analyzeExpressionStatement(node: ExpressionStatementNode): void {
    this.analyzeExpression(node.expression);
    // Don't add duplicate errors - the expression analyzer already adds them
  }

  private analyzeExpression(node: ExpressionNode, expectedType?: DataType): { type: DataType; isError: boolean; errorMessage?: string } {
    switch (node.type) {
      case NodeType.ASSIGNMENT:
        return this.analyzeAssignmentExpression(node as AssignmentNode);

      case NodeType.BINARY_EXPRESSION:
        return this.analyzeBinaryExpression(node as BinaryExpressionNode);

      case NodeType.UNARY_EXPRESSION:
        return this.analyzeUnaryExpression(node as UnaryExpressionNode);

      case NodeType.FUNCTION_CALL:
        return this.analyzeFunctionCall(node as FunctionCallNode);

      case NodeType.IDENTIFIER:
        return this.analyzeIdentifier(node as IdentifierNode);

      case NodeType.NUMBER_LITERAL:
        const literal = (node as NumberLiteralNode).value;
        const isHex = literal.toLowerCase().startsWith('0x');
        if (!isHex && literal.toLowerCase().endsWith('f')) {
          return { type: BuiltinTypes.FLOAT, isError: false };
        }
        if (literal.includes('.') || literal.toLowerCase().includes('e')) {
          return { type: BuiltinTypes.DOUBLE, isError: false };
        }
        if (literal.toLowerCase().endsWith('l')) {
          return { type: BuiltinTypes.LONG, isError: false };
        }
        return { type: BuiltinTypes.INT, isError: false };

      case NodeType.STRING_LITERAL:
        // Pointers to char for strings
        return { 
          type: { baseType: BaseType.CHAR, isPointer: true, pointerCount: 1 }, 
          isError: false 
        };

      case NodeType.CHARACTER_LITERAL:
        return { type: BuiltinTypes.CHAR, isError: false };

      case NodeType.SIZEOF_EXPRESSION:
        // sizeof always returns size_t which is typically unsigned long on 64-bit
        // For simplicity, we treat it as INT
        return { type: BuiltinTypes.INT, isError: false };

      case NodeType.CAST_EXPRESSION:
        // Type cast returns the target type
        const castNode = node as CastExpressionNode;
        return { type: this.parseDataType(castNode.targetType), isError: false };

      case NodeType.MEMBER_ACCESS:
        return this.analyzeMemberAccess(node as MemberAccessNode);

      case NodeType.ARRAY_ACCESS:
        // For now, return int type for array access
        // A full implementation would look up the array element type
        return { type: BuiltinTypes.INT, isError: false };

      case NodeType.INITIALIZER_LIST:
        return this.analyzeInitializerList(node as InitializerListNode, expectedType);

      case NodeType.COMPOUND_LITERAL:
        // Compound literal has the type specified in the literal
        return { type: BuiltinTypes.INT, isError: false };

      case NodeType.TERNARY_EXPRESSION:
        // Ternary expression: condition ? expr1 : expr2
        // Returns the type of expr1 (or expr2 if expr1 is void)
        return { type: BuiltinTypes.INT, isError: false };

      case NodeType.POSTFIX_EXPRESSION:
        // Postfix increment/decrement: a++, a--
        return { type: BuiltinTypes.INT, isError: false };

      default:
        return { type: BuiltinTypes.VOID, isError: true, errorMessage: 'Unknown expression type' };
    }
  }

  private analyzeMemberAccess(node: MemberAccessNode): { type: DataType; isError: boolean; errorMessage?: string } {
    // First, get the type of the object being accessed
    const objectResult = this.analyzeExpression(node.object);
    
    if (objectResult.isError) {
      return objectResult;
    }

    // Handle pointer-to-struct access (e.g., ptr->member)
    // or direct struct access (e.g., struct.member)
    let structType = objectResult.type;
    
    // If the object is a pointer, dereference it to get the struct type
    if (structType.isPointer && structType.pointerCount >= 1) {
      // For pointers to struct, assume the member is also a pointer to the same struct
      // This is a common pattern in kernel code (e.g., next->prev)
      if (structType.baseType === BaseType.STRUCT && structType.structName) {
        return {
          type: {
            baseType: BaseType.STRUCT,
            isPointer: true,
            pointerCount: 1,
            structName: structType.structName,
          },
          isError: false,
        };
      }
      // For void pointers or other pointers, return int as fallback
      return { type: BuiltinTypes.INT, isError: false };
    }

    // For direct struct access (not through pointer)
    if (structType.baseType === BaseType.STRUCT && structType.structName) {
      // Look up the struct definition
      const structInfo = this.symbolTable.getStruct(structType.structName);
      if (structInfo) {
        const member = structInfo.members.get(node.member);
        if (member) {
          return { type: member.type, isError: false };
        }
      }
      // If we can't find the struct info, assume int for simple members
      // This is a fallback for cases where we can't resolve the exact type
      return { type: BuiltinTypes.INT, isError: false };
    }

    // Fallback: return int
    return { type: BuiltinTypes.INT, isError: false };
  }

  private analyzeInitializerList(node: InitializerListNode, expectedType?: DataType): { type: DataType; isError: boolean; errorMessage?: string } {
    if (!expectedType) {
      return { type: BuiltinTypes.INT, isError: false };
    }

    // Basic analysis: check each item in the list
    for (const item of node.initializers) {
      // In a full implementation, we'd check if 'item.designator' matches 'expectedType'
      this.analyzeExpression(item.value);
    }

    return { type: expectedType, isError: false };
  }

  private analyzeBinaryExpression(node: BinaryExpressionNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const leftResult = this.analyzeExpression(node.left);
    const rightResult = this.analyzeExpression(node.right);

    if (leftResult.isError) {
      return leftResult;
    }

    if (rightResult.isError) {
      return rightResult;
    }

    return this.typeChecker.checkCompatible(leftResult.type, rightResult.type, node.operator);
  }

  private analyzeAssignmentExpression(node: AssignmentNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const targetResult = this.analyzeExpression(node.target);
    const valueResult = this.analyzeExpression(node.value);

    if (targetResult.isError) {
      return targetResult;
    }

    if (valueResult.isError) {
      return valueResult;
    }

    const result = this.typeChecker.checkCompatible(targetResult.type, valueResult.type, '=');
    if (result.isError) {
      this.errors.push({
        message: result.errorMessage!,
        line: node.line,
        column: node.column,
        node,
      });
    }

    return { type: targetResult.type, isError: result.isError, errorMessage: result.errorMessage };
  }

  private analyzeUnaryExpression(node: UnaryExpressionNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const operandResult = this.analyzeExpression(node.operand);

    if (operandResult.isError) {
      return operandResult;
    }

    // Pointer operators (&, *)
    if (node.operator === '&') {
      // Address-of: creates a pointer to the operand's type
      return {
        type: {
          baseType: operandResult.type.baseType,
          isPointer: true,
          pointerCount: operandResult.type.pointerCount + 1,
          structName: operandResult.type.structName,
        },
        isError: false,
      };
    }

    if (node.operator === '*') {
      // Dereference: follows a pointer to the underlying type
      if (!operandResult.type.isPointer) {
        return {
          type: BuiltinTypes.VOID,
          isError: true,
          errorMessage: `Cannot dereference non-pointer type ${typeToString(operandResult.type)}`,
        };
      }
      
      return {
        type: {
          baseType: operandResult.type.baseType,
          isPointer: operandResult.type.pointerCount > 1,
          pointerCount: operandResult.type.pointerCount - 1,
          structName: operandResult.type.structName,
        },
        isError: false,
      };
    }

    return this.typeChecker.checkUnary(operandResult.type, node.operator);
  }

  private analyzeFunctionCall(node: FunctionCallNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const argTypes: DataType[] = [];
    const argErrors: SemanticError[] = [];

    for (const arg of node.arguments) {
      const result = this.analyzeExpression(arg);
      if (result.isError) {
        argErrors.push({
          message: result.errorMessage!,
          line: arg.line,
          column: arg.column,
          node: arg,
        });
      } else {
        argTypes.push(result.type);
      }
    }

    // Get function name from callee (which may be an identifier or expression)
    let funcName: string;
    if (node.callee.type === NodeType.IDENTIFIER) {
      funcName = (node.callee as IdentifierNode).name;
    } else {
      funcName = 'unknown';
    }
    
    const callResult = this.typeChecker.checkFunctionCall(funcName, argTypes);
    
    // Add argument errors to main error list
    this.errors.push(...argErrors);

    return callResult;
  }

  private analyzeIdentifier(node: IdentifierNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const symbol = this.symbolTable.lookup(node.name);
    
    if (!symbol) {
      return {
        type: BuiltinTypes.VOID,
        isError: true,
        errorMessage: `Undeclared identifier '${node.name}'`,
      };
    }

    return { type: symbol.type, isError: false };
  }

  private parseDataType(typeNode: TypeSpecifierNode): DataType {
    let baseType: BaseType;
    let structName: string | undefined;

    if (typeNode.typeName.startsWith('struct ')) {
      baseType = BaseType.STRUCT;
      structName = typeNode.typeName.substring(7);
    } else {
      switch (typeNode.typeName) {
        case 'int': baseType = BaseType.INT; break;
        case 'char': baseType = BaseType.CHAR; break;
        case 'unsigned char': baseType = BaseType.CHAR; break;
        case 'unsigned int': baseType = BaseType.INT; break;
        case 'unsigned short': baseType = BaseType.INT; break;
        case 'unsigned long': baseType = BaseType.LONG; break;
        case 'long': baseType = BaseType.LONG; break;
        case 'float': baseType = BaseType.FLOAT; break;
        case 'double': baseType = BaseType.DOUBLE; break;
        case 'void': baseType = BaseType.VOID; break;
        case '...': baseType = BaseType.INT; break; // Treat ellipsis as int for now
        default: 
          // Check if this is a function pointer type (contains parentheses and asterisks)
          if (typeNode.typeName.includes('(*)') || typeNode.typeName.includes('(**)')) {
            baseType = BaseType.VOID; // Treat function pointers as void pointers
          } else {
            baseType = BaseType.INT; // Fallback
          }
          break;
      }
    }

    return {
      baseType,
      isPointer: typeNode.isPointer,
      pointerCount: typeNode.pointerCount,
      structName,
    };
  }
}