import { Token, TokenType } from '../lexer/Lexer';

export enum NodeType {
  // Program structure
  PROGRAM = 'PROGRAM',
  FUNCTION_DECLARATION = 'FUNCTION_DECLARATION',
  PARAMETER_LIST = 'PARAMETER_LIST',
  PARAMETER = 'PARAMETER',
  COMPOUND_STATEMENT = 'COMPOUND_STATEMENT',
  
  // Statements
  DECLARATION = 'DECLARATION',
  ASSIGNMENT = 'ASSIGNMENT',
  IF_STATEMENT = 'IF_STATEMENT',
  WHILE_STATEMENT = 'WHILE_STATEMENT',
  FOR_STATEMENT = 'FOR_STATEMENT',
  RETURN_STATEMENT = 'RETURN_STATEMENT',
  EXPRESSION_STATEMENT = 'EXPRESSION_STATEMENT',
  
  // Expressions
  BINARY_EXPRESSION = 'BINARY_EXPRESSION',
  UNARY_EXPRESSION = 'UNARY_EXPRESSION',
  FUNCTION_CALL = 'FUNCTION_CALL',
  ARGUMENT_LIST = 'ARGUMENT_LIST',
  
  // Literals and identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  CHARACTER_LITERAL = 'CHARACTER_LITERAL',
  
  // Types
  TYPE_SPECIFIER = 'TYPE_SPECIFIER',
}

export interface ASTNode {
  type: NodeType;
  line?: number;
  column?: number;
}

export interface ProgramNode extends ASTNode {
  type: NodeType.PROGRAM;
  declarations: (FunctionDeclarationNode | DeclarationNode)[];
}

export interface FunctionDeclarationNode extends ASTNode {
  type: NodeType.FUNCTION_DECLARATION;
  returnType: TypeSpecifierNode;
  name: string;
  parameters: ParameterNode[];
  body: CompoundStatementNode;
}

export interface ParameterNode extends ASTNode {
  type: NodeType.PARAMETER;
  varType: TypeSpecifierNode;
  name: string;
}

export interface TypeSpecifierNode extends ASTNode {
  type: NodeType.TYPE_SPECIFIER;
  typeName: string;
}

export interface CompoundStatementNode extends ASTNode {
  type: NodeType.COMPOUND_STATEMENT;
  statements: ASTNode[];
}

export interface DeclarationNode extends ASTNode {
  type: NodeType.DECLARATION;
  varType: TypeSpecifierNode;
  name: string;
  initializer?: ExpressionNode;
}

export interface AssignmentNode extends ASTNode {
  type: NodeType.ASSIGNMENT;
  target: IdentifierNode;
  value: ExpressionNode;
}

export interface IfStatementNode extends ASTNode {
  type: NodeType.IF_STATEMENT;
  condition: ExpressionNode;
  thenBranch: ASTNode;
  elseBranch?: ASTNode;
}

export interface WhileStatementNode extends ASTNode {
  type: NodeType.WHILE_STATEMENT;
  condition: ExpressionNode;
  body: ASTNode;
}

export interface ForStatementNode extends ASTNode {
  type: NodeType.FOR_STATEMENT;
  initialization?: DeclarationNode | ExpressionStatementNode;
  condition?: ExpressionNode;
  increment?: ExpressionNode;
  body: ASTNode;
}

export interface ReturnStatementNode extends ASTNode {
  type: NodeType.RETURN_STATEMENT;
  value?: ExpressionNode;
}

export interface ExpressionStatementNode extends ASTNode {
  type: NodeType.EXPRESSION_STATEMENT;
  expression: ExpressionNode;
}

export interface BinaryExpressionNode extends ASTNode {
  type: NodeType.BINARY_EXPRESSION;
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends ASTNode {
  type: NodeType.UNARY_EXPRESSION;
  operator: string;
  operand: ExpressionNode;
}

export interface FunctionCallNode extends ASTNode {
  type: NodeType.FUNCTION_CALL;
  name: string;
  arguments: ExpressionNode[];
}

export interface IdentifierNode extends ASTNode {
  type: NodeType.IDENTIFIER;
  name: string;
}

export interface NumberLiteralNode extends ASTNode {
  type: NodeType.NUMBER_LITERAL;
  value: string;
}

export interface StringLiteralNode extends ASTNode {
  type: NodeType.STRING_LITERAL;
  value: string;
}

export interface CharacterLiteralNode extends ASTNode {
  type: NodeType.CHARACTER_LITERAL;
  value: string;
}

export type ExpressionNode = 
  | BinaryExpressionNode
  | UnaryExpressionNode
  | FunctionCallNode
  | AssignmentNode
  | IdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | CharacterLiteralNode;

export type StatementNode = 
  | DeclarationNode
  | AssignmentNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | CompoundStatementNode;

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    if (this.current >= this.tokens.length) {
      return { type: TokenType.EOF, value: '', line: 0, column: 0 };
    }
    return this.tokens[this.current]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message}. Got ${this.peek().type} at line ${this.peek().line}, column ${this.peek().column}`);
  }

  private error(token: Token, message: string): void {
    throw new Error(`${message} at line ${token.line}, column ${token.column}`);
  }

  public parse(): ProgramNode {
    const declarations: (FunctionDeclarationNode | DeclarationNode)[] = [];
    
    while (!this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID)) {
        const declaration = this.parseDeclaration();
        if (declaration) {
          declarations.push(declaration);
        }
      } else {
        this.error(this.peek(), 'Expected declaration');
      }
    }
    
    return {
      type: NodeType.PROGRAM,
      declarations,
    };
  }

  private parseDeclaration(): FunctionDeclarationNode | DeclarationNode | null {
    const typeSpecifier = this.parseTypeSpecifier();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier after type');
    
    if (this.check(TokenType.LEFT_PAREN)) {
      return this.parseFunctionDeclaration(typeSpecifier, name.value);
    } else if (this.check(TokenType.SEMICOLON) || this.check(TokenType.ASSIGN)) {
      return this.parseVariableDeclaration(typeSpecifier, name.value);
    } else {
      this.error(this.peek(), 'Expected function declaration or variable declaration');
      return null;
    }
  }

  private parseTypeSpecifier(): TypeSpecifierNode {
    const token = this.advance();
    return {
      type: NodeType.TYPE_SPECIFIER,
      typeName: token.value,
      line: token.line,
      column: token.column,
    };
  }

  private parseFunctionDeclaration(returnType: TypeSpecifierNode, name: string): FunctionDeclarationNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after function name');
    const parameters = this.parseParameters();
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after parameters');
    
    const body = this.parseCompoundStatement();
    
    return {
      type: NodeType.FUNCTION_DECLARATION,
      returnType,
      name,
      parameters,
      body,
      line: returnType.line,
      column: returnType.column,
    };
  }

  private parseParameters(): ParameterNode[] {
    const parameters: ParameterNode[] = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const paramType = this.parseTypeSpecifier();
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name');
        parameters.push({
          type: NodeType.PARAMETER,
          varType: paramType,
          name: paramName.value,
          line: paramType.line,
          column: paramType.column,
        });
      } while (this.match(TokenType.COMMA));
    }
    
    return parameters;
  }

  private parseVariableDeclaration(varType: TypeSpecifierNode, name: string): DeclarationNode {
    let initializer: ExpressionNode | undefined;
    
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }
    
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after variable declaration');
    
    return {
      type: NodeType.DECLARATION,
      varType,
      name,
      initializer,
      line: varType.line,
      column: varType.column,
    };
  }

  private parseCompoundStatement(): CompoundStatementNode {
    this.consume(TokenType.LEFT_BRACE, 'Expected \'{\' to start compound statement');
    const statements: ASTNode[] = [];
    
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      statements.push(this.parseStatement());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected \'}\' to end compound statement');
    
    return {
      type: NodeType.COMPOUND_STATEMENT,
      statements,
      line: statements[0]?.line || 0,
      column: statements[0]?.column || 0,
    };
  }

  private parseStatement(): StatementNode {
    // Declaration
    if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID)) {
      const typeSpecifier = this.parseTypeSpecifier();
      const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier after type');
      return this.parseVariableDeclaration(typeSpecifier, name.value);
    }
    
    // If statement
    if (this.match(TokenType.IF)) {
      return this.parseIfStatement();
    }
    
    // While statement
    if (this.match(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }
    
    // For statement
    if (this.match(TokenType.FOR)) {
      return this.parseForStatement();
    }
    
    // Return statement
    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    
    // Compound statement
    if (this.check(TokenType.LEFT_BRACE)) {
      return this.parseCompoundStatement();
    }
    
    // Expression statement
    return this.parseExpressionStatement();
  }

  private parseIfStatement(): IfStatementNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after if');
    const condition = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after if condition');
    
    const thenBranch = this.parseStatement();
    let elseBranch: ASTNode | undefined;
    
    if (this.match(TokenType.ELSE)) {
      elseBranch = this.parseStatement();
    }
    
    return {
      type: NodeType.IF_STATEMENT,
      condition,
      thenBranch,
      elseBranch,
      line: thenBranch.line,
      column: thenBranch.column,
    };
  }

  private parseWhileStatement(): WhileStatementNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after while');
    const condition = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after while condition');
    
    const body = this.parseStatement();
    
    return {
      type: NodeType.WHILE_STATEMENT,
      condition,
      body,
      line: body.line,
      column: body.column,
    };
  }

  private parseForStatement(): ForStatementNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after for');
    
    let initialization: DeclarationNode | ExpressionStatementNode | undefined;
    if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID)) {
      const typeSpecifier = this.parseTypeSpecifier();
      const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier after type');
      initialization = this.parseVariableDeclaration(typeSpecifier, name.value);
    } else if (!this.check(TokenType.SEMICOLON)) {
      initialization = this.parseExpressionStatement();
    } else {
      this.advance(); // Skip semicolon
    }
    
    let condition: ExpressionNode | undefined;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.parseExpression();
    }
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after for condition');
    
    let increment: ExpressionNode | undefined;
    if (!this.check(TokenType.RIGHT_PAREN)) {
      increment = this.parseExpression();
    }
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after for clauses');
    
    const body = this.parseStatement();
    
    return {
      type: NodeType.FOR_STATEMENT,
      initialization,
      condition,
      increment,
      body,
      line: body.line,
      column: body.column,
    };
  }

  private parseReturnStatement(): ReturnStatementNode {
    let value: ExpressionNode | undefined;
    
    if (!this.check(TokenType.SEMICOLON)) {
      value = this.parseExpression();
    }
    
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after return');
    
    return {
      type: NodeType.RETURN_STATEMENT,
      value,
      line: value?.line || 0,
      column: value?.column || 0,
    };
  }

  private parseExpressionStatement(): ExpressionStatementNode {
    const expression = this.parseExpression();
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after expression');
    return {
      type: NodeType.EXPRESSION_STATEMENT,
      expression,
      line: expression.line,
      column: expression.column,
    };
  }

  private parseExpression(): ExpressionNode {
    return this.parseAssignment();
  }

  private parseAssignment(): ExpressionNode {
    const expr = this.parseLogicalOr();
    
    if (this.match(TokenType.ASSIGN)) {
      const value = this.parseAssignment();
      
      if (expr.type === NodeType.IDENTIFIER) {
        return {
          type: NodeType.ASSIGNMENT,
          target: expr,
          value,
          line: expr.line,
          column: expr.column,
        };
      }
      
      this.error(this.previous(), 'Invalid assignment target');
    }
    
    return expr;
  }

  private parseLogicalOr(): ExpressionNode {
    let expr = this.parseLogicalAnd();
    
    while (this.match(TokenType.OR)) {
      const operator = this.previous().value;
      const right = this.parseLogicalAnd();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseLogicalAnd(): ExpressionNode {
    let expr = this.parseEquality();
    
    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.parseEquality();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseEquality(): ExpressionNode {
    let expr = this.parseRelational();
    
    while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
      const operator = this.previous().value;
      const right = this.parseRelational();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseRelational(): ExpressionNode {
    let expr = this.parseShift();
    
    while (this.match(TokenType.LESS_THAN, TokenType.GREATER_THAN, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL)) {
      const operator = this.previous().value;
      const right = this.parseShift();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseShift(): ExpressionNode {
    let expr = this.parseAdditive();
    
    while (this.match(TokenType.LEFT_SHIFT, TokenType.RIGHT_SHIFT)) {
      const operator = this.previous().value;
      const right = this.parseAdditive();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseAdditive(): ExpressionNode {
    let expr = this.parseMultiplicative();
    
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.parseMultiplicative();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseMultiplicative(): ExpressionNode {
    let expr = this.parseUnary();
    
    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    
    return expr;
  }

  private parseUnary(): ExpressionNode {
    if (this.match(TokenType.NOT, TokenType.MINUS, TokenType.BITWISE_AND, TokenType.MULTIPLY)) {
      const operator = this.previous().value;
      const operand = this.parseUnary();
      return {
        type: NodeType.UNARY_EXPRESSION,
        operator,
        operand,
        line: operand.line,
        column: operand.column,
      };
    }
    
    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let expr = this.parsePrimary();
    
    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        const args: ExpressionNode[] = [];
        
        if (!this.check(TokenType.RIGHT_PAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        
        this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after arguments');
        
        expr = {
          type: NodeType.FUNCTION_CALL,
          name: (expr as IdentifierNode).name,
          arguments: args,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.INCREMENT) || this.match(TokenType.DECREMENT)) {
        const operator = this.previous().value;
        expr = {
          type: NodeType.UNARY_EXPRESSION,
          operator: operator + '_post', // Mark as postfix
          operand: expr,
          line: expr.line,
          column: expr.column,
        };
      } else {
        break;
      }
    }
    
    return expr;
  }

  private parsePrimary(): ExpressionNode {
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: NodeType.NUMBER_LITERAL,
        value: token.value,
        line: token.line,
        column: token.column,
      };
    }
    
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: NodeType.STRING_LITERAL,
        value: token.value,
        line: token.line,
        column: token.column,
      };
    }
    
    if (this.match(TokenType.CHARACTER)) {
      const token = this.previous();
      return {
        type: NodeType.CHARACTER_LITERAL,
        value: token.value,
        line: token.line,
        column: token.column,
      };
    }
    
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      return {
        type: NodeType.IDENTIFIER,
        name: token.value,
        line: token.line,
        column: token.column,
      };
    }
    
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after expression');
      return expr;
    }
    
    this.error(this.peek(), 'Expected expression');
    throw new Error('Unreachable');
  }
}