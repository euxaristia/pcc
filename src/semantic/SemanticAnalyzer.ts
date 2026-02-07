import { 
  ASTNode, NodeType, ProgramNode, FunctionDeclarationNode, 
  DeclarationNode, AssignmentNode, IfStatementNode, WhileStatementNode,
  ForStatementNode, ReturnStatementNode, ExpressionStatementNode,
  BinaryExpressionNode, UnaryExpressionNode, FunctionCallNode,
  IdentifierNode, NumberLiteralNode, StringLiteralNode, CharacterLiteralNode,
  TypeSpecifierNode, ParameterNode, CompoundStatementNode,
  ExpressionNode, StatementNode
} from '../parser/Parser';
import { SymbolTable, Symbol, DataType } from './SymbolTable';
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

    // Analyze function body
    this.analyzeCompoundStatement(node.body);

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
      const result = this.analyzeExpression(node.initializer);
      if (!result.isError && result.type !== varType) {
        this.errors.push({
          message: `Cannot initialize ${varType} variable '${node.name}' with value of type ${result.type}`,
          line: node.line,
          column: node.column,
          node,
        });
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
          message: `Function '${this.currentFunction.name}' expects to return ${expectedType}, but got ${result.type}`,
          line: node.line,
          column: node.column,
          node,
        });
      }
    } else {
      if (expectedType !== DataType.VOID) {
        this.errors.push({
          message: `Function '${this.currentFunction.name}' expects to return ${expectedType}, but got no value`,
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

  private analyzeExpression(node: ExpressionNode): { type: DataType; isError: boolean; errorMessage?: string } {
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
        return { type: DataType.INT, isError: false };

      case NodeType.STRING_LITERAL:
        this.errors.push({
          message: 'String literals not yet supported',
          line: node.line,
          column: node.column,
          node,
        });
        return { type: DataType.VOID, isError: true, errorMessage: 'String literals not yet supported' };

      case NodeType.CHARACTER_LITERAL:
        return { type: DataType.CHAR, isError: false };

      default:
        return { type: DataType.VOID, isError: true, errorMessage: 'Unknown expression type' };
    }
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

    // Handle different unary operators
    if (node.operator === '!') {
      return { type: DataType.INT, isError: false };
    }

    if (node.operator === '-' || node.operator === '++_post' || node.operator === '--_post' || node.operator === '++' || node.operator === '--') {
      if (operandResult.type === DataType.INT) {
        return { type: DataType.INT, isError: false };
      }
      return {
        type: DataType.INT,
        isError: true,
        errorMessage: `Unary operator '${node.operator}' cannot be applied to ${operandResult.type}`,
      };
    }

    // Pointer operators (&, *)
    if (node.operator === '&' || node.operator === '*') {
      this.errors.push({
        message: `Pointer operators '${node.operator}' not yet supported`,
        line: node.line,
        column: node.column,
        node,
      });
      return { type: DataType.VOID, isError: true, errorMessage: 'Pointer operators not yet supported' };
    }

    return { type: operandResult.type, isError: false };
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

    const callResult = this.typeChecker.checkFunctionCall(node.name, argTypes);
    
    // Add argument errors to main error list
    this.errors.push(...argErrors);

    return callResult;
  }

  private analyzeIdentifier(node: IdentifierNode): { type: DataType; isError: boolean; errorMessage?: string } {
    const symbol = this.symbolTable.lookup(node.name);
    
    if (!symbol) {
      return {
        type: DataType.VOID,
        isError: true,
        errorMessage: `Undeclared identifier '${node.name}'`,
      };
    }

    return { type: symbol.type, isError: false };
  }

  private parseDataType(typeNode: TypeSpecifierNode): DataType {
    switch (typeNode.typeName) {
      case 'int':
        return DataType.INT;
      case 'char':
        return DataType.CHAR;
      case 'void':
        return DataType.VOID;
      default:
        return DataType.VOID;
    }
  }
}