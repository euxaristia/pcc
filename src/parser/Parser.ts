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
  
  // Assembly
  ASM_STATEMENT = 'ASM_STATEMENT',
  
  // Attributes
  EXPORT_SYMBOL_STMT = 'EXPORT_SYMBOL_STMT',
  ATTRIBUTE_STMT = 'ATTRIBUTE_STMT',
  PREPROCESSOR_STMT = 'PREPROCESSOR_STMT',
  
  // Unary expressions
  SIZEOF_EXPRESSION = 'SIZEOF_EXPRESSION',
  
  // Cast expression
  CAST_EXPRESSION = 'CAST_EXPRESSION',
  
  // Array access
  ARRAY_ACCESS = 'ARRAY_ACCESS',
  
  // Member access
  MEMBER_ACCESS = 'MEMBER_ACCESS',
}

export interface ASTNode {
  type: NodeType;
  line?: number;
  column?: number;
}

export interface ProgramNode extends ASTNode {
  type: NodeType.PROGRAM;
  declarations: (FunctionDeclarationNode | DeclarationNode | StatementNode)[];
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
  isPointer: boolean;
  pointerCount: number;
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

export interface AsmStatementNode extends ASTNode {
  type: NodeType.ASM_STATEMENT;
  assembly: string;
  isVolatile: boolean;
}

export interface ExportSymbolNode extends ASTNode {
  type: NodeType.EXPORT_SYMBOL_STMT;
  symbol: string;
}

export interface AttributeNode extends ASTNode {
  type: NodeType.ATTRIBUTE_STMT;
  attribute: string;
  target?: string;
}

export interface PreprocessorNode extends ASTNode {
  type: NodeType.PREPROCESSOR_STMT;
  directive: string;
  content: string;
}

export interface AssignmentNode extends ASTNode {
  type: NodeType.ASSIGNMENT;
  target: IdentifierNode | MemberAccessNode | ArrayAccessNode;
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

export interface SizeofExpressionNode extends ASTNode {
  type: NodeType.SIZEOF_EXPRESSION;
  operand: TypeSpecifierNode | ExpressionNode;
  isType: boolean;  // true if sizeof(type), false if sizeof expression
}

export interface CastExpressionNode extends ASTNode {
  type: NodeType.CAST_EXPRESSION;
  targetType: TypeSpecifierNode;
  operand: ExpressionNode;
}

export interface ArrayAccessNode extends ASTNode {
  type: NodeType.ARRAY_ACCESS;
  array: ExpressionNode;
  index: ExpressionNode;
}

export interface MemberAccessNode extends ASTNode {
  type: NodeType.MEMBER_ACCESS;
  object: ExpressionNode;
  member: string;
}

export type ExpressionNode = 
  | BinaryExpressionNode
  | UnaryExpressionNode
  | FunctionCallNode
  | AssignmentNode
  | IdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | CharacterLiteralNode
  | SizeofExpressionNode
  | CastExpressionNode
  | ArrayAccessNode
  | MemberAccessNode;

export type StatementNode = 
  | DeclarationNode
  | AssignmentNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | CompoundStatementNode
  | AsmStatementNode
  | ExportSymbolNode
  | AttributeNode
  | PreprocessorNode;

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
      
      // Skip attributes like __init
      if (this.check(TokenType.INIT)) {
        this.advance();
        continue;
      }
      
      // Skip EXPORT_SYMBOL and other kernel directives
      if (this.check(TokenType.EXPORT_SYMBOL) || this.check(TokenType.ASM)) {
        const statement = this.parseStatement();
        if (statement) {
          declarations.push(statement as any);
        }
        continue;
      }
      
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID) || 
          this.check(TokenType.STRUCT) || this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
          this.check(TokenType.LONG) || this.check(TokenType.SHORT)) {
        // Special handling for struct definitions
        if (this.check(TokenType.STRUCT)) {
          const savedPosition = this.current;
          this.advance(); // consume 'struct'
          if (this.check(TokenType.IDENTIFIER)) {
            this.advance(); // consume struct name
            if (this.check(TokenType.LEFT_BRACE)) {
              // This is a struct definition, not a variable declaration
              // Backtrack and parse as type specifier
              this.current = savedPosition;
              this.parseTypeSpecifier();
              continue; // Skip to next iteration, struct definition handled
            }
          }
          // Not a struct definition, backtrack
          this.current = savedPosition;
        }
        
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
    let typeName = token.value;
    
    // Handle struct types
    if (token.type === TokenType.STRUCT) {
      this.consume(TokenType.IDENTIFIER, 'Expected struct name');
      const structName = this.previous().value;
      typeName = `struct ${structName}`;
      
      // Check for struct body definition: struct Point { int x; int y; };
      if (this.check(TokenType.LEFT_BRACE)) {
        // Parse struct body
        this.advance(); // consume '{'
        
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
          if (this.check(TokenType.NEWLINE)) {
            this.advance();
            continue;
          }
          
          // Parse member declaration
          if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
              this.check(TokenType.VOID) || this.check(TokenType.STRUCT) ||
              this.check(TokenType.LONG) || this.check(TokenType.SHORT) ||
              this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED)) {
            const memberType = this.parseTypeSpecifier();
            const memberName = this.consume(TokenType.IDENTIFIER, 'Expected member name');
            
            // Handle array members
            if (this.match(TokenType.LEFT_BRACKET)) {
              if (!this.check(TokenType.RIGHT_BRACKET)) {
                this.parseExpression(); // parse array size
              }
              this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
            }
            
            this.consume(TokenType.SEMICOLON, "Expected ';' after member declaration");
          }
        }
        
        this.consume(TokenType.RIGHT_BRACE, "Expected '}' after struct body");
        
        // After struct body, there might be variable declarations
        // e.g., struct Point { ... } p1, p2;
        // For now, we consume any variable names
        while (this.check(TokenType.IDENTIFIER)) {
          this.advance(); // consume variable name
          if (this.check(TokenType.COMMA)) {
            this.advance();
          } else {
            break;
          }
        }
        
        // Consume semicolon after struct definition if present
        if (this.check(TokenType.SEMICOLON)) {
          this.advance();
        }
      }
    }
    
    // Handle compound type specifiers
    // unsigned int, unsigned long, unsigned long long, signed int, etc.
    if (token.type === TokenType.UNSIGNED || token.type === TokenType.SIGNED) {
      if (this.check(TokenType.INT) || this.check(TokenType.LONG) || 
          this.check(TokenType.SHORT) || this.check(TokenType.CHAR)) {
        const nextToken = this.advance();
        typeName = `${typeName} ${nextToken.value}`;
        
        // Handle long long
        if (nextToken.type === TokenType.LONG && this.check(TokenType.LONG)) {
          this.advance();
          typeName = `${typeName} long`;
        }
      }
    } else if (token.type === TokenType.LONG) {
      // Handle long long
      if (this.check(TokenType.LONG)) {
        this.advance();
        typeName = 'long long';
      }
      // Handle long int
      if (this.check(TokenType.INT)) {
        this.advance();
      }
    } else if (token.type === TokenType.SHORT) {
      // Handle short int
      if (this.check(TokenType.INT)) {
        this.advance();
      }
    }
    
    let pointerCount = 0;
    
    // Count pointer modifiers
    while (this.match(TokenType.MULTIPLY)) {
      pointerCount++;
    }
    
    return {
      type: NodeType.TYPE_SPECIFIER,
      typeName,
      isPointer: pointerCount > 0,
      pointerCount,
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
        
        // Handle void parameter (int func(void))
        if (paramType.typeName === 'void') {
          // If the next token is not a comma and not a closing paren, 
          // then this void was not a standalone parameter
          if (!this.check(TokenType.RIGHT_PAREN)) {
            throw new Error('void must be the only parameter');
          }
          return []; // Return empty parameter list for void
        }
        
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
    let arraySize: ExpressionNode | undefined;
    
    // Check for array declaration: int arr[5];
    if (this.match(TokenType.LEFT_BRACKET)) {
      if (!this.check(TokenType.RIGHT_BRACKET)) {
        arraySize = this.parseExpression();
      }
      this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
      
      // Update type to be an array
      varType = {
        ...varType,
        isPointer: true,
        pointerCount: varType.pointerCount + 1,
      };
    }
    
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
    if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID) || 
        this.check(TokenType.STRUCT) || this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
        this.check(TokenType.LONG) || this.check(TokenType.SHORT)) {
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
    
    // Inline assembly
    if (this.match(TokenType.ASM)) {
      return this.parseAsmStatement();
    }
    
    // EXPORT_SYMBOL
    if (this.match(TokenType.EXPORT_SYMBOL)) {
      return this.parseExportSymbol();
    }
    
    // Attributes like __init - skip for now and let next declaration handle it
    if (this.match(TokenType.INIT)) {
      // Skip __init attribute and let the next function declaration handle it
      // This is a simplified approach
    }
    
    // Preprocessor directives
    if (this.match(TokenType.PREPROCESSOR)) {
      return this.parsePreprocessor();
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
      
      // Allow assignment to identifiers, member access, and array access
      if (expr.type === NodeType.IDENTIFIER || 
          expr.type === NodeType.MEMBER_ACCESS || 
          expr.type === NodeType.ARRAY_ACCESS) {
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
    // Handle type casting: (type) expression
    if (this.check(TokenType.LEFT_PAREN)) {
      const savedPosition = this.current;
      this.advance(); // consume '('
      
      // Check if it's a type cast by looking for a type keyword
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
          this.check(TokenType.VOID) || this.check(TokenType.STRUCT) ||
          this.check(TokenType.LONG) || this.check(TokenType.SHORT) ||
          this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED)) {
        // It's a type cast
        const targetType = this.parseTypeSpecifier();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after type in cast");
        const operand = this.parseUnary(); // Cast has high precedence
        return {
          type: NodeType.CAST_EXPRESSION,
          targetType,
          operand,
          line: targetType.line,
          column: targetType.column,
        };
      } else {
        // Not a type cast, backtrack and parse as parenthesized expression
        this.current = savedPosition;
      }
    }

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
    
    // Handle sizeof operator
    if (this.match(TokenType.SIZEOF)) {
      return this.parseSizeof();
    }
    
    return this.parsePostfix();
  }

  private parseSizeof(): SizeofExpressionNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    // sizeof(type) or sizeof expression
    if (this.match(TokenType.LEFT_PAREN)) {
      // Check if it's a type or an expression
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
          this.check(TokenType.VOID) || this.check(TokenType.STRUCT)) {
        // It's sizeof(type)
        const typeSpec = this.parseTypeSpecifier();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after type in sizeof");
        return {
          type: NodeType.SIZEOF_EXPRESSION,
          operand: typeSpec,
          isType: true,
          line,
          column,
        };
      } else {
        // It's sizeof(expression)
        const expr = this.parseExpression();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression in sizeof");
        return {
          type: NodeType.SIZEOF_EXPRESSION,
          operand: expr,
          isType: false,
          line,
          column,
        };
      }
    } else {
      // sizeof expression without parentheses
      const expr = this.parseUnary();
      return {
        type: NodeType.SIZEOF_EXPRESSION,
        operand: expr,
        isType: false,
        line,
        column,
      };
    }
  }

  private parsePostfix(): ExpressionNode {
    let expr = this.parsePrimary();
    
    while (true) {
      // Array subscript: arr[index]
      if (this.match(TokenType.LEFT_BRACKET)) {
        const index = this.parseExpression();
        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array index");
        
        expr = {
          type: NodeType.ARRAY_ACCESS,
          array: expr,
          index: index,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.LEFT_PAREN)) {
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
      } else if (this.match(TokenType.DOT)) {
        // Member access: obj.member
        const memberToken = this.consume(TokenType.IDENTIFIER, "Expected member name after '.'");
        expr = {
          type: NodeType.MEMBER_ACCESS,
          object: expr,
          member: memberToken.value,
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

  private parseAsmStatement(): AsmStatementNode {
    const isVolatile = this.match(TokenType.VOLATILE);
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after asm');
    this.consume(TokenType.STRING, 'Expected string literal with assembly code');
    const assembly = this.previous().value;
    
    // Parse optional output operands (starts with ':')
    if (this.match(TokenType.COLON)) {
      // Skip output operands - they are comma-separated constraint expressions
      while (!this.check(TokenType.COLON) && !this.check(TokenType.RIGHT_PAREN)) {
        if (this.match(TokenType.COMMA)) {
          continue;
        }
        // Skip constraint strings and expressions
        if (this.check(TokenType.STRING)) {
          this.advance();
        } else if (this.check(TokenType.LEFT_PAREN)) {
          // Skip parenthesized expression
          this.advance();
          while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
            this.advance();
          }
          if (this.check(TokenType.RIGHT_PAREN)) {
            this.advance();
          }
        } else {
          this.advance();
        }
      }
    }
    
    // Parse optional input operands (starts with ':')
    if (this.match(TokenType.COLON)) {
      // Skip input operands - they are comma-separated constraint expressions
      while (!this.check(TokenType.COLON) && !this.check(TokenType.RIGHT_PAREN)) {
        if (this.match(TokenType.COMMA)) {
          continue;
        }
        // Skip constraint strings and expressions
        if (this.check(TokenType.STRING)) {
          this.advance();
        } else if (this.check(TokenType.LEFT_PAREN)) {
          // Skip parenthesized expression
          this.advance();
          while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
            this.advance();
          }
          if (this.check(TokenType.RIGHT_PAREN)) {
            this.advance();
          }
        } else {
          this.advance();
        }
      }
    }
    
    // Parse optional clobbered registers (starts with ':')
    if (this.match(TokenType.COLON)) {
      // Skip clobber list - comma-separated strings
      while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
        if (this.match(TokenType.COMMA)) {
          continue;
        }
        this.advance();
      }
    }
    
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after assembly');
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after asm statement');
    
    return {
      type: NodeType.ASM_STATEMENT,
      assembly: assembly.replace(/^"(.*)"$/, '$1'), // Remove quotes
      isVolatile,
      line: this.previous().line,
      column: this.previous().column,
    };
  }

  private parseExportSymbol(): ExportSymbolNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after EXPORT_SYMBOL');
    this.consume(TokenType.IDENTIFIER, 'Expected symbol name');
    const symbol = this.previous().value;
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after symbol name');
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after EXPORT_SYMBOL');
    
    return {
      type: NodeType.EXPORT_SYMBOL_STMT,
      symbol,
      line: this.previous().line,
      column: this.previous().column,
    };
  }

  private parseAttribute(): AttributeNode {
    const attribute = this.previous().value;
    
    // For now, we'll just consume the next function declaration
    // In a full implementation, we'd associate this with the following declaration
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after attribute');
    
    return {
      type: NodeType.ATTRIBUTE_STMT,
      attribute,
      line: this.previous().line,
      column: this.previous().column,
    };
  }

  private parsePreprocessor(): PreprocessorNode {
    const content = this.previous().value;
    const parts = content.split(/\s+/);
    const directive = parts[0];
    
    return {
      type: NodeType.PREPROCESSOR_STMT,
      directive,
      content: content.substring(1), // Remove #
      line: this.previous().line,
      column: this.previous().column,
    };
  }
}