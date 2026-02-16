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
  MULTI_DECLARATION = 'MULTI_DECLARATION',
  ASSIGNMENT = 'ASSIGNMENT',
  IF_STATEMENT = 'IF_STATEMENT',
  WHILE_STATEMENT = 'WHILE_STATEMENT',
  FOR_STATEMENT = 'FOR_STATEMENT',
  DO_WHILE_STATEMENT = 'DO_WHILE_STATEMENT',
  GOTO_STATEMENT = 'GOTO_STATEMENT',
  LABEL_STATEMENT = 'LABEL_STATEMENT',
  EMPTY_STATEMENT = 'EMPTY_STATEMENT',
  RETURN_STATEMENT = 'RETURN_STATEMENT',
  EXPRESSION_STATEMENT = 'EXPRESSION_STATEMENT',
  
  // Expressions
  BINARY_EXPRESSION = 'BINARY_EXPRESSION',
  UNARY_EXPRESSION = 'UNARY_EXPRESSION',
  POSTFIX_EXPRESSION = 'POSTFIX_EXPRESSION',
  FUNCTION_CALL = 'FUNCTION_CALL',
  ARGUMENT_LIST = 'ARGUMENT_LIST',
  TERNARY_EXPRESSION = 'TERNARY_EXPRESSION',
  
  // Literals and identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  CHARACTER_LITERAL = 'CHARACTER_LITERAL',
  
  // Types
  TYPE_SPECIFIER = 'TYPE_SPECIFIER',
  INITIALIZER_LIST = 'INITIALIZER_LIST',
  COMPOUND_LITERAL = 'COMPOUND_LITERAL',
  
  // Declarations
  ENUM_DECLARATION = 'ENUM_DECLARATION',
  UNION_DECLARATION = 'UNION_DECLARATION',
  STRUCT_DECLARATION = 'STRUCT_DECLARATION',
  
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
  
  // Typedef
  TYPEDEF_DECLARATION = 'TYPEDEF_DECLARATION',
  
  // Control flow
  SWITCH_STATEMENT = 'SWITCH_STATEMENT',
  CASE_STATEMENT = 'CASE_STATEMENT',
  DEFAULT_STATEMENT = 'DEFAULT_STATEMENT',
  BREAK_STATEMENT = 'BREAK_STATEMENT',
  CONTINUE_STATEMENT = 'CONTINUE_STATEMENT',
}

export interface ASTNode {
  type: NodeType;
  line?: number;
  column?: number;
}

export interface ProgramNode extends ASTNode {
  type: NodeType.PROGRAM;
  declarations: (FunctionDeclarationNode | DeclarationNode | MultiDeclarationNode | StatementNode)[];
}

export interface FunctionDeclarationNode extends ASTNode {
  type: NodeType.FUNCTION_DECLARATION;
  returnType: TypeSpecifierNode;
  name: string;
  parameters: ParameterNode[];
  body?: CompoundStatementNode;
  storageClass?: 'extern' | 'static' | 'inline';
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
  qualifiers: ('const' | 'volatile' | 'restrict')[];
  params?: ParameterNode[]; // For function pointers
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
  storageClass?: 'extern' | 'static' | 'inline';
}

export interface MultiDeclarationNode extends ASTNode {
  type: NodeType.MULTI_DECLARATION;
  declarations: DeclarationNode[];
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

export interface TypedefDeclarationNode extends ASTNode {
  type: NodeType.TYPEDEF_DECLARATION;
  originalType: TypeSpecifierNode;
  alias: string;
}

export interface SwitchStatementNode extends ASTNode {
  type: NodeType.SWITCH_STATEMENT;
  expression: ExpressionNode;
  cases: CaseStatementNode[];
  defaultCase?: DefaultStatementNode;
}

export interface CaseStatementNode extends ASTNode {
  type: NodeType.CASE_STATEMENT;
  value: ExpressionNode;
  statements: StatementNode[];
}

export interface DefaultStatementNode extends ASTNode {
  type: NodeType.DEFAULT_STATEMENT;
  statements: StatementNode[];
}

export interface BreakStatementNode extends ASTNode {
  type: NodeType.BREAK_STATEMENT;
}

export interface ContinueStatementNode extends ASTNode {
  type: NodeType.CONTINUE_STATEMENT;
}

export interface EmptyStatementNode extends ASTNode {
  type: NodeType.EMPTY_STATEMENT;
}

export interface AssignmentNode extends ASTNode {
  type: NodeType.ASSIGNMENT;
  target: IdentifierNode | MemberAccessNode | ArrayAccessNode | UnaryExpressionNode;
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
  initialization?: DeclarationNode | MultiDeclarationNode | ExpressionStatementNode;
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

export interface PostfixExpressionNode extends ASTNode {
  type: NodeType.POSTFIX_EXPRESSION;
  operator: string;
  operand: ExpressionNode;
}

export interface FunctionCallNode extends ASTNode {
  type: NodeType.FUNCTION_CALL;
  callee: ExpressionNode;
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

export interface InitializerListNode extends ASTNode {
  type: NodeType.INITIALIZER_LIST;
  initializers: InitializerNode[];
}

export interface CompoundLiteralNode extends ASTNode {
  type: NodeType.COMPOUND_LITERAL;
  typeSpec: TypeSpecifierNode;
  initializers: ExpressionNode[];
}

export interface InitializerNode extends ASTNode {
  type: NodeType.INITIALIZER_LIST;
  designator?: string | ExpressionNode;
  value: ExpressionNode;
}

export interface TernaryExpressionNode extends ASTNode {
  type: NodeType.TERNARY_EXPRESSION;
  condition: ExpressionNode;
  thenBranch: ExpressionNode;
  elseBranch: ExpressionNode;
}

export interface DoWhileStatementNode extends ASTNode {
  type: NodeType.DO_WHILE_STATEMENT;
  body: StatementNode;
  condition: ExpressionNode;
}

export interface GotoStatementNode extends ASTNode {
  type: NodeType.GOTO_STATEMENT;
  label: string;
}

export interface LabelStatementNode extends ASTNode {
  type: NodeType.LABEL_STATEMENT;
  name: string;
}

export interface EnumDeclarationNode extends ASTNode {
  type: NodeType.ENUM_DECLARATION;
  name: string;
  values: EnumValueNode[];
}

export interface EnumValueNode extends ASTNode {
  type: NodeType.ENUM_DECLARATION; // Reuse enum type
  name: string;
  value?: ExpressionNode;
}

export interface UnionDeclarationNode extends ASTNode {
  type: NodeType.UNION_DECLARATION;
  name: string;
  fields: (DeclarationNode | MultiDeclarationNode)[];
}

export interface StructDeclarationNode extends ASTNode {
  type: NodeType.STRUCT_DECLARATION;
  varType: TypeSpecifierNode;
  name: string;
  storageClass?: string;
}

export type ExpressionNode = 
  | BinaryExpressionNode
  | UnaryExpressionNode
  | PostfixExpressionNode
  | FunctionCallNode
  | AssignmentNode
  | IdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | CharacterLiteralNode
  | SizeofExpressionNode
  | CastExpressionNode
  | ArrayAccessNode
  | MemberAccessNode
  | TernaryExpressionNode
  | InitializerListNode
  | CompoundLiteralNode;

export type StatementNode = 
  | DeclarationNode
  | MultiDeclarationNode
  | AssignmentNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | DoWhileStatementNode
  | GotoStatementNode
  | LabelStatementNode
  | EmptyStatementNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | CompoundStatementNode
  | AsmStatementNode
  | ExportSymbolNode
  | AttributeNode
  | PreprocessorNode
  | TypedefDeclarationNode
  | SwitchStatementNode
  | CaseStatementNode
  | DefaultStatementNode
  | BreakStatementNode
  | ContinueStatementNode
  | EnumDeclarationNode
  | UnionDeclarationNode
  | StructDeclarationNode
  | MultiDeclarationNode
  | InitializerListNode;

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    
    // Initialize common kernel typedefs for xv6 compatibility
    this.initializeKernelTypedefs();
  }

  private initializeKernelTypedefs(): void {
    // Common xv6/kernel types
    this.typedefs.set('uchar', {
      type: NodeType.TYPE_SPECIFIER,
      typeName: 'unsigned char',
      isPointer: false,
      pointerCount: 0,
      qualifiers: [],
      line: 0,
      column: 0,
    });
    
    this.typedefs.set('uint', {
      type: NodeType.TYPE_SPECIFIER,
      typeName: 'unsigned int',
      isPointer: false,
      pointerCount: 0,
      qualifiers: [],
      line: 0,
      column: 0,
    });
    
    this.typedefs.set('ushort', {
      type: NodeType.TYPE_SPECIFIER,
      typeName: 'unsigned short',
      isPointer: false,
      pointerCount: 0,
      qualifiers: [],
      line: 0,
      column: 0,
    });
    
    this.typedefs.set('ulong', {
      type: NodeType.TYPE_SPECIFIER,
      typeName: 'unsigned long',
      isPointer: false,
      pointerCount: 0,
      qualifiers: [],
      line: 0,
      column: 0,
    });
    
    // Add other common kernel types as needed
    this.typedefs.set('pde_t', {
      type: NodeType.TYPE_SPECIFIER,
      typeName: 'unsigned long',
      isPointer: true,
      pointerCount: 1,
      qualifiers: [],
      line: 0,
      column: 0,
    });
  }

  private peek(offset: number = 0): Token {
    const index = this.current + offset;
    if (index >= this.tokens.length) {
      return { type: TokenType.EOF, value: '', line: 0, column: 0 };
    }
    return this.tokens[index]!;
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
    const declarations: (FunctionDeclarationNode | DeclarationNode | MultiDeclarationNode | StatementNode)[] = [];
    
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
      
      // Handle attributes that can appear before declarations
      if (this.check(TokenType.ATTRIBUTE)) {
        // This could be an attribute before a declaration, so try to parse as declaration
        const declaration = this.parseDeclaration();
        if (declaration) {
          declarations.push(declaration);
        }
        continue;
      }
      
      // Attributes and other kernel directives
      if (this.check(TokenType.EXPORT_SYMBOL) || this.check(TokenType.ASM) || this.check(TokenType.TYPEDEF) || this.check(TokenType.ENUM) || this.check(TokenType.PREPROCESSOR)) {
        const statement = this.parseStatement();
        if (statement) {
          declarations.push(statement as any);
        }
        continue;
      }
      
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID) || 
          this.check(TokenType.STRUCT) || this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
          this.check(TokenType.LONG) || this.check(TokenType.SHORT) || this.check(TokenType.FLOAT) || this.check(TokenType.DOUBLE) ||
          this.check(TokenType.STATIC) || this.check(TokenType.EXTERN) || this.check(TokenType.INLINE) ||
          this.check(TokenType.CONST) || this.check(TokenType.VOLATILE) || this.check(TokenType.RESTRICT) ||
          this.check(TokenType.ENUM) || this.check(TokenType.UNION) ||
          (this.check(TokenType.IDENTIFIER) && this.typedefs.has(this.peek().value))) {
        
        const declaration = this.parseDeclaration();
        if (declaration) {
          declarations.push(declaration);
        }
      } else if (this.match(TokenType.SEMICOLON)) {
        // Skip extra semicolons
        continue;
      } else {
        this.error(this.peek(), 'Expected declaration');
      }
    }
    
    return {
      type: NodeType.PROGRAM,
      declarations,
    };
  }

  private parseDeclaration(): FunctionDeclarationNode | DeclarationNode | MultiDeclarationNode | null {
    // Handle attributes that can appear before declarations (e.g., __attribute__((aligned(...))))
    while (this.match(TokenType.ATTRIBUTE)) {
      this.parseAttributeInDeclaration(); // Parse and ignore the attribute for now
    }
    
    // Handle storage class specifiers
    const storageClasses: string[] = [];
    while (this.match(TokenType.EXTERN, TokenType.STATIC, TokenType.INLINE)) {
      storageClasses.push(this.previous().value);
    }
    
    console.log(`parseDeclaration: next token after storage classes: ${this.peek().type} ${this.peek().value}`);
    console.log(`About to call parseTypeSpecifier, current token: ${this.peek().type} '${this.peek().value}' at ${this.peek().line}:${this.peek().column}`);
    const typeSpecifier = this.parseTypeSpecifier();
    console.log(`After parseTypeSpecifier: typeName=${typeSpecifier.typeName}, next token: ${this.peek().type} '${this.peek().value}' at ${this.peek().line}:${this.peek().column}`);
    console.log(`DEBUG: this.current=${this.current}, tokens.length=${this.tokens.length}`);
    console.log(`DEBUG: tokens[${this.current}]=${this.tokens[this.current]?.type} '${this.tokens[this.current]?.value}'`);
    console.log(`Will now check: this.check(TokenType.IDENTIFIER)=${this.check(TokenType.IDENTIFIER)}, this.check(TokenType.LEFT_PAREN)=${this.check(TokenType.LEFT_PAREN)}`);
    
    // Check if we have an identifier (might be an anonymous struct/union/enum if followed by ;)
    if (!this.check(TokenType.IDENTIFIER)) {
      if (this.check(TokenType.SEMICOLON)) {
        this.advance();
        
        // Return a special declaration node for type definitions
        let nodeType = NodeType.DECLARATION;
        if (typeSpecifier.typeName.startsWith('struct')) nodeType = NodeType.STRUCT_DECLARATION as any;
        else if (typeSpecifier.typeName.startsWith('union')) nodeType = NodeType.UNION_DECLARATION as any;
        else if (typeSpecifier.typeName.startsWith('enum')) nodeType = NodeType.ENUM_DECLARATION as any;

        return {
          type: nodeType,
          varType: typeSpecifier,
          name: '',
          storageClass: storageClasses.join(' ') as any,
          line: typeSpecifier.line,
          column: typeSpecifier.column,
        } as any;
      }
    }


    
    // Check for function pointer declarator: type (*name)(params) or type (*name)(params) = initializer
    // Also handle: type (*name[size])(params) - array of function pointers
    if (this.check(TokenType.LEFT_PAREN)) {
      const savedPos = this.current;
      this.advance(); // consume '('
      
      if (this.match(TokenType.MULTIPLY)) {
        // This is a function pointer declarator
        // Handle multiple asterisks
        let pointerStars = '*';
        while (this.match(TokenType.MULTIPLY)) {
          pointerStars += '*';
        }
        
        // Consume the identifier name
        const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected identifier in function pointer declarator');
        const name = nameToken.value;

        // Handle array specifier BEFORE the closing paren: (*name[size])
        let arraySize: ExpressionNode | undefined;
        if (this.match(TokenType.LEFT_BRACKET)) {
          if (!this.check(TokenType.RIGHT_BRACKET)) {
            arraySize = this.parseExpression();
          }
          this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
        }
        
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer name");
        
        // Parse parameter list
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after function pointer");
        if (this.check(TokenType.VOID)) {
          this.advance(); // consume 'void'
        } else if (!this.check(TokenType.RIGHT_PAREN)) {
          // Parse parameters for real
          const params = this.parseParameters();
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer parameters");
        
        // Handle array declarations for function pointers (if not already handled above)
        if (!arraySize && this.match(TokenType.LEFT_BRACKET)) {
          if (!this.check(TokenType.RIGHT_BRACKET)) {
            arraySize = this.parseExpression();
          }
          this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
        }
        
        let initializer: ExpressionNode | undefined;
        if (this.match(TokenType.ASSIGN)) {
          initializer = this.parseInitializer();
        }

        this.consume(TokenType.SEMICOLON, "Expected ';' after declaration");
        
        // Create declaration node with function pointer type
        const declaration: DeclarationNode = {
          type: NodeType.DECLARATION,
          varType: {
            type: NodeType.TYPE_SPECIFIER,
            typeName: `${typeSpecifier.typeName}(${pointerStars})()`,
            isPointer: true,
            pointerCount: pointerStars.length + (arraySize ? 1 : 0),
            qualifiers: typeSpecifier.qualifiers || [],
            line: typeSpecifier.line,
            column: typeSpecifier.column,
          },
          name,
          initializer,
          storageClass: storageClasses.join(' ') as any,
          line: typeSpecifier.line,
          column: typeSpecifier.column,
        };
        
        console.log(`Function pointer declaration: ${name}, next token: ${this.peek().type} ${this.peek().value}`);
        return declaration;
      } else {
        // Not a function pointer, backtrack and try normal identifier
        this.current = savedPos;
      }
    }
    
    // Check for function pointer declarator: type (*name)(params) or just (*name)(params)
    if (this.check(TokenType.LEFT_PAREN)) {
      const savedPos = this.current;
      this.advance(); // consume '('
      
      if (this.match(TokenType.MULTIPLY)) {
        // This is a function pointer declarator
        // Handle multiple asterisks
        let pointerStars = '*';
        while (this.match(TokenType.MULTIPLY)) {
          pointerStars += '*';
        }
        
        // Consume the identifier name
        const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected identifier in function pointer declarator');
        const name = nameToken.value;
        
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer name");
        
        // Parse parameter list
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after function pointer");
        if (this.check(TokenType.VOID)) {
          this.advance(); // consume 'void'
        } else if (!this.check(TokenType.RIGHT_PAREN)) {
          // Parse parameters for real
          const params = this.parseParameters();
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer parameters");
        
        // Handle array declarations for function pointers (rare)
        let arraySize: ExpressionNode | undefined;
        if (this.match(TokenType.LEFT_BRACKET)) {
          if (!this.check(TokenType.RIGHT_BRACKET)) {
            arraySize = this.parseExpression();
          }
          this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
        }
        
        let initializer: ExpressionNode | undefined;
        if (this.match(TokenType.ASSIGN)) {
          initializer = this.parseInitializer();
        }

        this.consume(TokenType.SEMICOLON, "Expected ';' after declaration");
        
        // Create declaration node with function pointer type
        const declaration: DeclarationNode = {
          type: NodeType.DECLARATION,
          varType: {
            type: NodeType.TYPE_SPECIFIER,
            typeName: `${typeSpecifier.typeName}(${pointerStars})()`,
            isPointer: true,
            pointerCount: pointerStars.length + (arraySize ? 1 : 0),
            qualifiers: typeSpecifier.qualifiers || [],
            line: typeSpecifier.line,
            column: typeSpecifier.column,
          },
          name,
          initializer,
          storageClass: storageClasses.join(' ') as any,
          line: typeSpecifier.line,
          column: typeSpecifier.column,
        };
        
        console.log(`Function pointer declaration: ${name}, next token: ${this.peek().type} ${this.peek().value}`);
        return declaration;
      } else {
        // Not a function pointer, backtrack and try normal identifier
        this.current = savedPos;
      }
    }
    
    if (!this.check(TokenType.IDENTIFIER)) {
      if (this.check(TokenType.SEMICOLON)) {
        this.advance();
        return null; // Empty declaration (e.g., struct foo { ... };)
      }
    }

    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected identifier after type');
    const name = nameToken.value;
    console.log(`After consuming identifier '${name}', next token: ${this.peek().type} '${this.peek().value}' at ${this.peek().line}:${this.peek().column}`);
    console.log(`DEBUG: After consume, this.current=${this.current}`);
    
    // Check for function pointer array declarations like void (*func_ptr_array[4])
    if (this.check(TokenType.LEFT_PAREN)) {
      console.log(`DEBUG: Entering LEFT_PAREN check block, this.current=${this.current}`);
      const savedPos = this.current;
      this.advance(); // consume '('
      console.log(`DEBUG: After advance past '(', this.current=${this.current}, peek=${this.peek().type}`);
      
      // Check if this is a function pointer array: type (*name[size])
      if (this.match(TokenType.MULTIPLY)) {
        console.log(`DEBUG: Matched MULTIPLY`);
        // This is a function pointer or function pointer array
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer");
        
        // Now check if we have an array after the function pointer
        if (this.match(TokenType.LEFT_BRACKET)) {
          // Parse array size
          if (!this.check(TokenType.RIGHT_BRACKET)) {
            this.parseExpression();
          }
          this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
          
          // Function pointer array declaration
          this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer array");
          this.consume(TokenType.SEMICOLON, "Expected ';' after function pointer array declaration");
          
          return {
            type: NodeType.DECLARATION,
            varType: {
              type: NodeType.TYPE_SPECIFIER,
              typeName: `${typeSpecifier.typeName}(*)`, // Function pointer array
              isPointer: true,
              pointerCount: 1,
              qualifiers: typeSpecifier.qualifiers || [],
              line: typeSpecifier.line,
              column: typeSpecifier.column,
            },
            name,
            storageClass: storageClasses.join(' ') as any,
            line: typeSpecifier.line,
            column: typeSpecifier.column,
          };
        }
        
        // Not a function pointer array, backtrack and parse normally
        this.current = savedPos;
        console.log(`DEBUG: Backtracked to savedPos=${savedPos}`);
      } else {
        // Not a function pointer array, backtrack
        this.current = savedPos;
        console.log(`DEBUG: Backtracked to savedPos=${savedPos}`);
      }
      console.log(`DEBUG: Exiting LEFT_PAREN block without returning, this.current=${this.current}`);
    }
    
    if (this.check(TokenType.LEFT_PAREN)) {
      
      return this.parseFunctionDeclaration(typeSpecifier, name, storageClasses.join(' '));
    } else {
      return this.parseVariableDeclaration(typeSpecifier, name, storageClasses.join(' '));
    }
  }

  private parseTypeSpecifier(): TypeSpecifierNode {
    const qualifiers: ('const' | 'volatile' | 'restrict')[] = [];
    while (this.match(TokenType.CONST, TokenType.VOLATILE, TokenType.RESTRICT)) {
      qualifiers.push(this.previous().value as any);
    }

    const token = this.advance();
    let typeName = token.value;
    
    // Check for typedef alias
    if (token.type === TokenType.IDENTIFIER && this.typedefs.has(token.value)) {
      const typedefType = this.typedefs.get(token.value)!;
      let pointerCount = 0;
      while (this.match(TokenType.MULTIPLY)) {
        pointerCount++;
      }
      return {
        type: NodeType.TYPE_SPECIFIER,
        typeName: typedefType.typeName,
        isPointer: typedefType.isPointer || pointerCount > 0,
        pointerCount: typedefType.pointerCount + pointerCount,
        qualifiers: [...qualifiers, ...(typedefType.qualifiers || [])],
        line: token.line,
        column: token.column,
      };
    }
    
    // Handle struct/union types
    if (token.type === TokenType.STRUCT || token.type === TokenType.UNION) {
      const isUnion = token.type === TokenType.UNION;
      
      // Handle attributes after struct/union keyword
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }

      let structName = '';
      if (this.check(TokenType.IDENTIFIER)) {
        structName = this.advance().value;
      }
      
      // Handle attributes after struct/union name
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }

      typeName = structName ? `${isUnion ? 'union' : 'struct'} ${structName}` : (isUnion ? 'union' : 'struct');
      
      // Check for struct/union body definition: struct Point { int x; int y; };
      if (this.check(TokenType.LEFT_BRACE)) {
        // Parse struct/union body
        this.advance(); // consume '{'
        
        const members: DeclarationNode[] = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
          if (this.check(TokenType.NEWLINE)) {
            this.advance();
            continue;
          }
          
          // Check for nested struct/union/enum without a type name first
          if (this.check(TokenType.STRUCT) || this.check(TokenType.UNION) || this.check(TokenType.ENUM)) {
            const nestedType = this.parseTypeSpecifier();
            
            // If followed by semicolon, it's an anonymous nested member
            if (this.check(TokenType.SEMICOLON)) {
              members.push({
                type: NodeType.DECLARATION,
                varType: nestedType,
                name: '',
                line: nestedType.line,
                column: nestedType.column,
              });
              this.advance(); // consume ';'
              continue;
            }
            
            // If followed by identifier, it's a named member of that nested type
            if (this.check(TokenType.IDENTIFIER)) {
              const memberName = this.advance();
              members.push({
                type: NodeType.DECLARATION,
                varType: nestedType,
                name: memberName.value,
                line: nestedType.line,
                column: nestedType.column,
              });
              
              // Handle array declarators
              if (this.match(TokenType.LEFT_BRACKET)) {
                if (!this.check(TokenType.RIGHT_BRACKET)) {
                  this.parseExpression();
                }
                this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
              }
              
              this.consume(TokenType.SEMICOLON, "Expected ';' after member declaration");
              continue;
            }
          }

          // Parse member declaration normally
          if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
              this.check(TokenType.VOID) || this.check(TokenType.STRUCT) || this.check(TokenType.ENUM) ||
              this.check(TokenType.UNION) ||
              this.check(TokenType.LONG) || this.check(TokenType.SHORT) ||
              this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
              this.check(TokenType.FLOAT) || this.check(TokenType.DOUBLE) ||
              this.check(TokenType.STATIC) || this.check(TokenType.EXTERN) || this.check(TokenType.INLINE) ||
              this.check(TokenType.CONST) || this.check(TokenType.VOLATILE) || this.check(TokenType.RESTRICT) ||
              (this.check(TokenType.IDENTIFIER) && this.typedefs.has(this.peek().value))) {
            const memberType = this.parseTypeSpecifier();
            
            // Handle anonymous members (rare but possible in some extensions)
            if (this.check(TokenType.SEMICOLON)) {
              this.advance();
              continue;
            }

            // Handle function pointer members: void (*callback)(int, void *)
            // After parsing type (e.g., void), we might see (*name)(params)
            let memberNameValue: string;
            if (this.check(TokenType.LEFT_PAREN)) {
              // This is a function pointer member - parse (*name)(params)
              const savedPos = this.current;
              this.advance(); // consume '('
              if (this.check(TokenType.MULTIPLY)) {
                // Got (*name) - consume * and identifier, then )
                this.advance(); // consume *
                const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected member name');
                memberNameValue = nameToken.value;
                this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer name");
                // Skip until we hit ;
                while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
                  this.advance();
                }
              } else {
                // Not a function pointer, backtrack
                this.current = savedPos;
                const memberName = this.consume(TokenType.IDENTIFIER, 'Expected member name');
                memberNameValue = memberName.value;
              }
            } else {
              const memberName = this.consume(TokenType.IDENTIFIER, 'Expected member name');
              memberNameValue = memberName.value;
            }
            
            members.push({
              type: NodeType.DECLARATION,
              varType: memberType,
              name: memberNameValue,
              line: memberType.line,
              column: memberType.column,
            });
            
            // Handle array declarators and bit fields
            if (this.match(TokenType.LEFT_BRACKET)) {
              if (!this.check(TokenType.RIGHT_BRACKET)) {
                this.parseExpression();
              }
              this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
            }
            
            if (this.match(TokenType.COLON)) {
              this.parseExpression();
            }
            
            this.consume(TokenType.SEMICOLON, "Expected ';' after member declaration");
            continue;
          } else {
            // Safety: if we don't recognize it, skip it to avoid infinite loop
            this.advance();
          }
        }
        
        this.consume(TokenType.RIGHT_BRACE, "Expected '}' after struct body");
        
        // Handle attributes after struct/union body
        while (this.match(TokenType.ATTRIBUTE)) {
          this.parseAttributeInDeclaration();
        }
        
        // After struct body, there might be variable declarations
        // e.g., struct Point { ... } p1, p2;
        // This is handled by the caller (parseDeclaration)
      }
    }
    
    // Handle enum types
    if (token.type === TokenType.ENUM) {
      // Handle attributes after enum keyword
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }

      if (this.check(TokenType.IDENTIFIER)) {
        const enumName = this.advance().value;
        typeName = `enum ${enumName}`;
      } else {
        // Anonymous enum
        typeName = 'enum';
      }
      
      // Handle attributes after enum name
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }

      // Check for enum body definition: enum Color { RED, GREEN, BLUE };
      if (this.check(TokenType.LEFT_BRACE)) {
        // Parse enum body - for now, just consume it
        this.advance(); // consume '{'
        let braceCount = 1;
        while (braceCount > 0 && !this.isAtEnd()) {
          if (this.match(TokenType.LEFT_BRACE)) {
            braceCount++;
          } else if (this.match(TokenType.RIGHT_BRACE)) {
            braceCount--;
          } else {
            this.advance();
          }
        }

        // Handle attributes after enum body
        while (this.match(TokenType.ATTRIBUTE)) {
          this.parseAttributeInDeclaration();
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
    
    // For casts, support basic function pointer types like void(*)(void) or void(**)(void)
    // BUT: don't do this for declarations like int (*func_ptr)(void) where (*func_ptr) is followed by ()
    if (this.check(TokenType.LEFT_PAREN)) {
      const savedPos = this.current;
      this.advance(); // consume '('
      
        if (this.match(TokenType.MULTIPLY)) {
        // Function pointer type for casts
        let pointerStars = '*';
        while (this.match(TokenType.MULTIPLY)) {
          pointerStars += '*';
        }
        
        // For casts like void(*)(void), there might not be an identifier next
        if (this.check(TokenType.IDENTIFIER)) {
          // Check if followed by [ (array) or ( (function) - if so, this is a declaration not a cast
          // Also check for ) followed by ( - that's a function pointer declaration
          const nextAfterIdent = this.peek(1).type;
          if (nextAfterIdent === TokenType.LEFT_BRACKET || nextAfterIdent === TokenType.LEFT_PAREN) {
            // This is likely a declaration like void (*func)(void) or void (*func_array[4]), not a cast
            this.current = savedPos;
          } else if (nextAfterIdent === TokenType.RIGHT_PAREN) {
            // After identifier we have ) - check what comes after )
            const afterRightParen = this.peek(2);
            if (afterRightParen.type === TokenType.LEFT_PAREN) {
              // This is a function pointer declaration like (*func_ptr)(void)
              this.current = savedPos;
            } else {
              // It's a cast with an identifier as the type - consume the identifier and continue
              this.advance(); // consume the identifier (type name)
            }
          } else {
            // It's a cast with an identifier as the type - consume the identifier and continue
            this.advance(); // consume the identifier (type name)
          }
        } else {
          // In the context of parseUnary handling casts, we should proceed with function pointer type parsing
          // Don't backtrack even if followed by ( - it could be a cast like (void(*)(void))(x)
          this.consume(TokenType.RIGHT_PAREN, "Expected ')' after * in function pointer type");
          
          // Parse parameter list for function pointer type
          this.consume(TokenType.LEFT_PAREN, "Expected '(' after function pointer type");
          if (this.check(TokenType.VOID)) {
            this.advance(); // consume 'void'
          } else if (!this.check(TokenType.RIGHT_PAREN)) {
            // Parse parameters for real
            const params = this.parseParameters();
          }
          this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function pointer type parameters");
          
          // Build function pointer type name for casts
          typeName = `${typeName}(${pointerStars})()`;
        }
      } else {
        // Not a function pointer type, backtrack
        this.current = savedPos;
      }
    }
    
    return {
      type: NodeType.TYPE_SPECIFIER,
      typeName,
      isPointer: pointerCount > 0,
      pointerCount,
      qualifiers,
      line: token.line,
      column: token.column,
    };
  }

  private parseFunctionDeclaration(returnType: TypeSpecifierNode, name: string, storageClass?: string): FunctionDeclarationNode {
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after function name');
    const parameters = this.parseParameters();
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after parameters');
    
    // Parse optional __attribute__ after function parameters
    if (this.match(TokenType.ATTRIBUTE)) {
      this.parseAttributeInDeclaration(); // Parse without consuming semicolon
    }
    
    let body: CompoundStatementNode | undefined;
    if (this.check(TokenType.LEFT_BRACE)) {
      body = this.parseCompoundStatement();
    } else {
      this.consume(TokenType.SEMICOLON, "Expected ';' after function declaration");
    }
    
    return {
      type: NodeType.FUNCTION_DECLARATION,
      returnType,
      name,
      parameters,
      body,
      storageClass: storageClass as any,
      line: returnType.line,
      column: returnType.column,
    };
  }

  private parseParameters(): ParameterNode[] {
    
    const parameters: ParameterNode[] = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        // Handle ellipsis - check for both ELLIPSIS token and DOT followed by more dots
        if (this.match(TokenType.ELLIPSIS)) {
          parameters.push({
            type: NodeType.PARAMETER,
            varType: { 
              type: NodeType.TYPE_SPECIFIER,
              typeName: '...', 
              isPointer: false, 
              pointerCount: 0, 
              qualifiers: [],
              line: this.previous().line, 
              column: this.previous().column 
            },
            name: '...',
            line: this.previous().line,
            column: this.previous().column,
          });
          break;
        }
        
        // Handle case where lexer produces DOT instead of ELLIPSIS
        if (this.check(TokenType.DOT)) {
          // Check if this is actually an ellipsis by looking at the token stream
          const tokens = [];
          let i = 0;
          while (i < 3 && this.check(TokenType.DOT)) {
            tokens.push(this.advance());
            i++;
          }
          if (i === 3) {
            // We found three dots, treat as ellipsis
            parameters.push({
              type: NodeType.PARAMETER,
              varType: { 
                type: NodeType.TYPE_SPECIFIER,
                typeName: '...', 
                isPointer: false, 
                pointerCount: 0, 
                qualifiers: [],
                line: tokens[0].line, 
                column: tokens[0].column 
              },
              name: '...',
              line: tokens[0].line,
              column: tokens[0].column,
            });
            break;
          } else {
            // Not an ellipsis, put tokens back and handle as error
            this.current -= i; // Put tokens back
          }
        }

        const paramType = this.parseTypeSpecifier();
        
        
        // Handle void parameter (int func(void))
        if (paramType.typeName === 'void' && !paramType.isPointer) {
          if (this.check(TokenType.RIGHT_PAREN)) {
            return []; // Return empty parameter list for void
          }
        }
        
        let name = "";
        if (this.check(TokenType.IDENTIFIER)) {
          name = this.advance().value;
        } else {
          // Anonymous parameter in prototype
          name = `__anon_param_${parameters.length}`;
        }

        parameters.push({
          type: NodeType.PARAMETER,
          varType: paramType,
          name: name,
          line: paramType.line,
          column: paramType.column,
        });
      } while (this.match(TokenType.COMMA));
    }
    
    return parameters;
  }

  private parseVariableDeclaration(varType: TypeSpecifierNode, firstName: string, storageClass?: string): DeclarationNode | MultiDeclarationNode {
    const declarations: DeclarationNode[] = [];
    
    let currentName = firstName;
    let currentType = varType;

    while (true) {
      // Support __attribute__ after variable name
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }

      let arraySize: ExpressionNode | undefined;
      let initializer: ExpressionNode | undefined;

      // Check for array declaration: int arr[5];
      if (this.match(TokenType.LEFT_BRACKET)) {
        if (!this.check(TokenType.RIGHT_BRACKET)) {
          arraySize = this.parseExpression();
        }
        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
        
        // Support __attribute__ after array declarator
        while (this.match(TokenType.ATTRIBUTE)) {
          this.parseAttributeInDeclaration();
        }

        // Update type to be an array
        currentType = {
          ...currentType,
          isPointer: true,
          pointerCount: currentType.pointerCount + 1,
        };
      }
      
      // Support __attribute__ after variable declarator
      while (this.match(TokenType.ATTRIBUTE)) {
        this.parseAttributeInDeclaration();
      }
      
      if (this.match(TokenType.ASSIGN)) {
        initializer = this.parseInitializer();
      }

      declarations.push({
        type: NodeType.DECLARATION,
        varType: currentType,
        name: currentName,
        initializer,
        storageClass: storageClass as any,
        line: currentType.line,
        column: currentType.column,
      });

      if (this.match(TokenType.COMMA)) {
        // In C, "int *a, b;" means a is pointer, b is int.
        // But "int *a, *b;" means both are pointers.
        // The typeSpecifier passed in is the base type (int).
        currentType = varType; 
        
        // Handle pointer stars for the NEXT variable
        let nextPointerCount = 0;
        while (this.match(TokenType.MULTIPLY)) {
          nextPointerCount++;
        }
        if (nextPointerCount > 0) {
          currentType = {
            ...currentType,
            isPointer: true,
            pointerCount: nextPointerCount,
          };
        }

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected identifier after ',' in declaration");
        currentName = nameToken.value;
      } else {
        break;
      }
    }
    
    // Handle asm variable attributes: extern int x asm("reg");
    if (this.match(TokenType.ASM)) {
      // Parse asm attribute with string literal
      this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after asm');
      const asmString = this.consume(TokenType.STRING, 'Expected string literal in asm attribute');
      this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after asm string');
      // For now, just ignore the asm attribute
    }
    
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after variable declaration');
    
    if (declarations.length === 1) {
      return declarations[0];
    }
    
    return {
      type: NodeType.MULTI_DECLARATION,
      declarations,
      line: varType.line,
      column: varType.column,
    };
  }

  private parseInitializer(): ExpressionNode {
    if (this.check(TokenType.LEFT_BRACE)) {
      return this.parseInitializerList();
    }
    return this.parseAssignment();
  }

  private parseInitializerList(): InitializerListNode {
    const line = this.peek().line;
    const column = this.peek().column;
    this.consume(TokenType.LEFT_BRACE, "Expected '{' to start initializer list");
    
    const initializers: InitializerNode[] = [];
    
    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        while (this.check(TokenType.NEWLINE)) this.advance();
        if (this.check(TokenType.RIGHT_BRACE)) break;

        let designator: string | ExpressionNode | undefined;
        
        // Handle designated initializers
        if (this.match(TokenType.DOT)) {
          // .member = value
          designator = this.consume(TokenType.IDENTIFIER, "Expected member name after '.'").value;
          this.consume(TokenType.ASSIGN, "Expected '=' after designator");
        } else if (this.match(TokenType.LEFT_BRACKET)) {
          // [index] = value
          designator = this.parseExpression();
          this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after index");
          this.consume(TokenType.ASSIGN, "Expected '=' after designator");
        }
        
        const value = this.parseInitializer();
        initializers.push({
          type: NodeType.INITIALIZER_LIST,
          designator,
          value,
          line: value.line,
          column: value.column,
        });
        
        while (this.check(TokenType.NEWLINE)) this.advance();
      } while (this.match(TokenType.COMMA));
    }
    
    while (this.check(TokenType.NEWLINE)) this.advance();
    this.consume(TokenType.RIGHT_BRACE, "Expected '}' after initializer list");
    
    return {
      type: NodeType.INITIALIZER_LIST,
      initializers,
      line,
      column,
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

  private typedefs: Map<string, TypeSpecifierNode> = new Map();

  private parseStatement(): StatementNode {
    // Label (identifier followed by colon)
    if (this.check(TokenType.IDENTIFIER) && this.peek(1).type === TokenType.COLON) {
      const labelToken = this.consume(TokenType.IDENTIFIER, 'Expected label');
      this.consume(TokenType.COLON, 'Expected \':\' after label');
      return {
        type: NodeType.LABEL_STATEMENT,
        name: labelToken.value,
        line: labelToken.line,
        column: labelToken.column,
      };
    }

    // Empty statement
    if (this.match(TokenType.SEMICOLON)) {
      return {
        type: NodeType.EMPTY_STATEMENT,
        line: this.previous().line,
        column: this.previous().column,
      };
    }

    // Inline assembly (asm, volatile asm, __volatile__ asm)
    if (this.match(TokenType.ASM)) {
      return this.parseAsmStatement();
    }
    
    if (this.check(TokenType.VOLATILE)) {
      const savedPosition = this.current;
      this.advance();
      if (this.match(TokenType.ASM)) {
        return this.parseAsmStatement();
      }
      this.current = savedPosition;
    }
    
    // Declaration
    if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID) || 
        this.check(TokenType.STRUCT) || this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
        this.check(TokenType.LONG) || this.check(TokenType.SHORT) || this.check(TokenType.FLOAT) || this.check(TokenType.DOUBLE) ||
        this.check(TokenType.CONST) || this.check(TokenType.VOLATILE) || this.check(TokenType.RESTRICT) ||
        this.check(TokenType.STATIC) || this.check(TokenType.EXTERN) || this.check(TokenType.INLINE) ||
        this.check(TokenType.ENUM) || this.check(TokenType.UNION) ||
        (this.check(TokenType.IDENTIFIER) && this.typedefs.has(this.peek().value))) {
      return this.parseDeclaration() as any;
    }

    // Typedef
    if (this.match(TokenType.TYPEDEF)) {
      return this.parseTypedef();
    }
    
    // Switch statement
    if (this.match(TokenType.SWITCH)) {
      return this.parseSwitchStatement();
    }

    // Enum declaration
    if (this.match(TokenType.ENUM)) {
      return this.parseEnumDeclaration();
    }
    
    // Union declaration
    if (this.match(TokenType.UNION)) {
      return this.parseUnionDeclaration();
    }
    
    // Return statement
    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    
    // EXPORT_SYMBOL
    if (this.match(TokenType.EXPORT_SYMBOL)) {
      return this.parseExportSymbol();
    }
    
    // Attributes like __init - skip for now and let next declaration handle it
    if (this.match(TokenType.INIT)) {
      return this.parseStatement();
    }
    
    // GCC Attributes
    if (this.match(TokenType.ATTRIBUTE)) {
      return this.parseAttribute();
    }
    
    // Break statement
    if (this.match(TokenType.BREAK)) {
      this.consume(TokenType.SEMICOLON, "Expected ';' after break");
      return {
        type: NodeType.BREAK_STATEMENT,
        line: this.previous().line,
        column: this.previous().column,
      };
    }
    
    // Continue statement
    if (this.match(TokenType.CONTINUE)) {
      this.consume(TokenType.SEMICOLON, "Expected ';' after continue");
      return {
        type: NodeType.CONTINUE_STATEMENT,
        line: this.previous().line,
        column: this.previous().column,
      };
    }
    
    // If statement
    if (this.match(TokenType.IF)) {
      return this.parseIfStatement();
    }
    
    // While statement
    if (this.match(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }
    
    // Do-while statement
    if (this.match(TokenType.DO)) {
      return this.parseDoWhileStatement();
    }
    
    // For statement
    if (this.match(TokenType.FOR)) {
      return this.parseForStatement();
    }
    
    // Goto statement
    if (this.match(TokenType.GOTO)) {
      const label = this.consume(TokenType.IDENTIFIER, 'Expected label after goto');
      this.consume(TokenType.SEMICOLON, "Expected ';' after goto");
      return {
        type: NodeType.GOTO_STATEMENT,
        label: label.value,
        line: label.line,
        column: label.column,
      };
    }
    
    // Enum declaration
    if (this.match(TokenType.ENUM)) {
      return this.parseEnumDeclaration();
    }
    
    // Union declaration
    if (this.match(TokenType.UNION)) {
      return this.parseUnionDeclaration();
    }
    
    // Return statement
    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    
    // EXPORT_SYMBOL
    if (this.match(TokenType.EXPORT_SYMBOL)) {
      return this.parseExportSymbol();
    }
    
    // Attributes like __init - skip for now and let next declaration handle it
    if (this.match(TokenType.INIT)) {
      return this.parseStatement();
    }
    
    // GCC Attributes
    if (this.match(TokenType.ATTRIBUTE)) {
      return this.parseAttribute();
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
    
    let initialization: DeclarationNode | MultiDeclarationNode | ExpressionStatementNode | undefined;
    if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || this.check(TokenType.VOID) ||
        this.check(TokenType.LONG) || (this.check(TokenType.IDENTIFIER) && this.typedefs.has(this.peek().value))) {
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

  private parseDoWhileStatement(): DoWhileStatementNode {
    const body = this.parseStatement();
    this.consume(TokenType.WHILE, 'Expected while after do');
    this.consume(TokenType.LEFT_PAREN, 'Expected \'(\' after while');
    const condition = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after while condition');
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after do-while');
    
    return {
      type: NodeType.DO_WHILE_STATEMENT,
      body,
      condition,
      line: body.line,
      column: body.column,
    };
  }

  private parseEnumDeclaration(): EnumDeclarationNode {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected enum name');
    const name = nameToken.value;
    
    this.consume(TokenType.LEFT_BRACE, 'Expected \'{\' after enum name');
    const values: EnumValueNode[] = [];
    
    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        const valueName = this.consume(TokenType.IDENTIFIER, 'Expected enum value name');
        let value: ExpressionNode | undefined;
        
        if (this.match(TokenType.ASSIGN)) {
          value = this.parseExpression();
        }
        
        values.push({
          type: NodeType.ENUM_DECLARATION,
          name: valueName.value,
          value,
          line: valueName.line,
          column: valueName.column,
        });
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected \'}\' after enum values');
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after enum declaration');
    
    return {
      type: NodeType.ENUM_DECLARATION,
      name,
      values,
      line: nameToken.line,
      column: nameToken.column,
    };
  }

  private parseUnionDeclaration(): UnionDeclarationNode {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected union name');
    const name = nameToken.value;
    
    this.consume(TokenType.LEFT_BRACE, 'Expected \'{\' after union name');
    const fields: (DeclarationNode | MultiDeclarationNode)[] = [];
    
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      const fieldType = this.parseTypeSpecifier();
      const fieldName = this.consume(TokenType.IDENTIFIER, 'Expected field name');
      const field = this.parseVariableDeclaration(fieldType, fieldName.value);
      // parseVariableDeclaration already consumes the semicolon
      fields.push(field);
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected \'}\' after union fields');
    this.consume(TokenType.SEMICOLON, 'Expected \';\' after union declaration');
    
    return {
      type: NodeType.UNION_DECLARATION,
      name,
      fields,
      line: nameToken.line,
      column: nameToken.column,
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
    return this.parseComma();
  }

  private parseComma(): ExpressionNode {
    let expr = this.parseAssignment();
    
    while (this.match(TokenType.COMMA)) {
      const operator = this.previous().value;
      const right = this.parseAssignment();
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

  private parseAssignment(): ExpressionNode {
    const expr = this.parseTernary();
    
    if (this.match(TokenType.ASSIGN) || 
        this.match(TokenType.PLUS_ASSIGN) ||
        this.match(TokenType.MINUS_ASSIGN) ||
        this.match(TokenType.MULTIPLY_ASSIGN) ||
        this.match(TokenType.DIVIDE_ASSIGN) ||
        this.match(TokenType.MODULO_ASSIGN) ||
        this.match(TokenType.AND_ASSIGN) ||
        this.match(TokenType.OR_ASSIGN) ||
        this.match(TokenType.XOR_ASSIGN) ||
        this.match(TokenType.LEFT_SHIFT_ASSIGN) ||
        this.match(TokenType.RIGHT_SHIFT_ASSIGN)) {
      const operatorToken = this.previous();
      const value = this.parseAssignment();
      
      // Allow assignment to identifiers, member access, array access, and unary (dereference)
      if (expr.type === NodeType.IDENTIFIER || 
          expr.type === NodeType.MEMBER_ACCESS || 
          expr.type === NodeType.ARRAY_ACCESS ||
          expr.type === NodeType.UNARY_EXPRESSION) {
        
        let finalValue = value;
        if (operatorToken.type !== TokenType.ASSIGN) {
          // Desugar: x += y  =>  x = x + y
          const op = operatorToken.value.slice(0, -1); // remove '='
          finalValue = {
            type: NodeType.BINARY_EXPRESSION,
            operator: op,
            left: expr,
            right: value,
            line: operatorToken.line,
            column: operatorToken.column,
          };
        }

        return {
          type: NodeType.ASSIGNMENT,
          target: expr,
          value: finalValue,
          line: expr.line,
          column: expr.column,
        };
      }
      
      this.error(operatorToken, 'Invalid assignment target');
    }
    
    return expr;
  }

  private parseTernary(): ExpressionNode {
    const condition = this.parseLogicalOr();
    
    if (this.match(TokenType.QUESTION)) {
      const thenBranch = this.parseAssignment();
      this.consume(TokenType.COLON, 'Expected \':\' in ternary expression');
      const elseBranch = this.parseAssignment();
      
      return {
        type: NodeType.TERNARY_EXPRESSION,
        condition,
        thenBranch,
        elseBranch,
        line: condition.line,
        column: condition.column,
      };
    }
    
    return condition;
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
    let expr = this.parseBitwiseOr();
    
    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.parseBitwiseOr();
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

  private parseBitwiseOr(): ExpressionNode {
    let expr = this.parseBitwiseXor();
    
    while (this.match(TokenType.BITWISE_OR)) {
      const operator = this.previous().value;
      const right = this.parseBitwiseXor();
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

  private parseBitwiseXor(): ExpressionNode {
    let expr = this.parseBitwiseAnd();
    
    while (this.match(TokenType.BITWISE_XOR)) {
      const operator = this.previous().value;
      const right = this.parseBitwiseAnd();
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

  private parseBitwiseAnd(): ExpressionNode {
    let expr = this.parseEquality();
    
    while (this.match(TokenType.BITWISE_AND)) {
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
    // Also handle compound literals: (type){initializer}
    let expr: ExpressionNode | null = null;
    
    if (this.check(TokenType.LEFT_PAREN)) {
      const savedPosition = this.current;
      this.advance(); // consume '('
      
      // Check if it's a type cast or compound literal by looking for a type keyword or typedef
      const nextToken = this.peek();
      // Also check for identifiers that could be types (like uintptr_t) - they are followed by ) or *
      const couldBeType = nextToken.type === TokenType.IDENTIFIER && 
        (this.typedefs.has(nextToken.value) || 
         this.peek(1).type === TokenType.RIGHT_PAREN || 
         this.peek(1).type === TokenType.MULTIPLY);
      
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
          this.check(TokenType.VOID) || this.check(TokenType.STRUCT) ||
          this.check(TokenType.LONG) || this.check(TokenType.SHORT) ||
          this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
          this.check(TokenType.FLOAT) || this.check(TokenType.DOUBLE) ||
          this.check(TokenType.CONST) || this.check(TokenType.VOLATILE) ||
          this.check(TokenType.UNION) || this.check(TokenType.ENUM) ||
          couldBeType) {
        // It's a type cast OR compound literal
        const targetType = this.parseTypeSpecifier();
        
        // Check for compound literal: (type){initializer}
        // Note: after parseTypeSpecifier, pointers have been consumed
        if (this.check(TokenType.RIGHT_PAREN)) {
          const afterParen = this.peek(1);
          if (afterParen.type === TokenType.LEFT_BRACE) {
            // It's a compound literal: (type){initializer}
            this.advance(); // consume ')'
            this.advance(); // consume '{'
            
            // Parse initializer list
            const initializers: ExpressionNode[] = [];
            if (!this.check(TokenType.RIGHT_BRACE)) {
              do {
                initializers.push(this.parseAssignment());
              } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RIGHT_BRACE, "Expected '}' after compound literal initializers");
            
            return {
              type: NodeType.COMPOUND_LITERAL,
              typeSpec: targetType,
              initializers,
              line: targetType.line,
              column: targetType.column,
            };
          }
          
          // It's a type cast: (type)expression
          this.advance(); // consume ')'
          expr = this.parseMultiplicative();
          
          // Check for additive operators after the cast operand
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
          
          // After the cast, there might be postfix operators like function call ()
          // Continue parsing postfix operators on the result
          while (this.check(TokenType.LEFT_PAREN)) {
            // Function call
            this.advance(); // consume '('
            const args: ExpressionNode[] = [];
            if (!this.check(TokenType.RIGHT_PAREN)) {
              do {
                args.push(this.parseAssignment());
              } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function call arguments");
            expr = {
              type: NodeType.FUNCTION_CALL,
              callee: expr,
              arguments: args,
              line: expr.line,
              column: expr.column,
            };
          }
          
          // Now we have the cast result in expr
          // Continue to handle any outer unary operators (like * for dereference)
        }
      } else {
        // Not a type cast, backtrack and parse as parenthesized expression
        this.current = savedPosition;
      }
    }
    
    // If we parsed a cast/compound-literal, use it as expr
    // Otherwise, parse the unary operator chain
    if (!expr) {
      if (this.match(TokenType.NOT, TokenType.MINUS, TokenType.BITWISE_AND, TokenType.MULTIPLY, TokenType.INCREMENT, TokenType.DECREMENT, TokenType.TILDE)) {
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
      
      expr = this.parsePostfix();
    } else {
      // We parsed a cast - now check for outer unary operators
      // e.g., *(int*)ptr - the * is applied to the cast result
      while (this.match(TokenType.NOT, TokenType.MINUS, TokenType.BITWISE_AND, TokenType.MULTIPLY, TokenType.INCREMENT, TokenType.DECREMENT, TokenType.TILDE)) {
        const operator = this.previous().value;
        expr = {
          type: NodeType.UNARY_EXPRESSION,
          operator,
          operand: expr,
          line: expr.line,
          column: expr.column,
        };
      }
    }
    
    return expr;
  }

  private parseSizeof(): SizeofExpressionNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    // sizeof(type) or sizeof expression
    if (this.match(TokenType.LEFT_PAREN)) {
      // Check if it's a type or an expression
      if (this.check(TokenType.INT) || this.check(TokenType.CHAR) || 
          this.check(TokenType.VOID) || this.check(TokenType.STRUCT) ||
          this.check(TokenType.LONG) || this.check(TokenType.SHORT) ||
          this.check(TokenType.UNSIGNED) || this.check(TokenType.SIGNED) ||
          (this.check(TokenType.IDENTIFIER) && this.typedefs.has(this.peek().value))) {
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
            args.push(this.parseAssignment());
          } while (this.match(TokenType.COMMA));
        }
        
        this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after arguments');
        
        expr = {
          type: NodeType.FUNCTION_CALL,
          callee: expr,
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
      } else if (this.match(TokenType.ARROW)) {
        // Arrow operator: ptr->member (desugar to (*ptr).member)
        const memberToken = this.consume(TokenType.IDENTIFIER, "Expected member name after '->'");
        expr = {
          type: NodeType.MEMBER_ACCESS,
          object: {
            type: NodeType.UNARY_EXPRESSION,
            operator: '*',
            operand: expr,
            line: expr.line,
            column: expr.column,
          },
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
    
    // Handle regular parenthesized expressions
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RIGHT_PAREN, 'Expected \')\' after expression');
      return expr;
    }
    
    this.error(this.peek(), 'Expected expression');
    throw new Error('Unreachable');
  }

  private parseAsmConstraint(): string {
    let constraint = "";
    while (this.check(TokenType.STRING)) {
      constraint += this.advance().value;
    }
    return constraint;
  }

  private parseAsmStatement(): AsmStatementNode {
    let isVolatile = this.previous().type === TokenType.VOLATILE;
    while (this.match(TokenType.VOLATILE, TokenType.INLINE)) {
      if (this.previous().type === TokenType.VOLATILE) isVolatile = true;
    }
    
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after asm");
    
    // GCC allows multiple string literals that are concatenated
    let assembly = "";
    while (this.check(TokenType.STRING)) {
      assembly += this.advance().value;
    }
    
    // Parse optional output operands (starts with ':')
    if (this.match(TokenType.COLON)) {
      if (!this.check(TokenType.COLON) && !this.check(TokenType.RIGHT_PAREN)) {
        do {
          this.parseAsmConstraint();
          if (this.match(TokenType.LEFT_PAREN)) {
            this.parseExpression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after asm expression");
          }
        } while (this.match(TokenType.COMMA));
      }
    }
    
    // Parse optional input operands (starts with ':')
    if (this.match(TokenType.COLON)) {
      if (!this.check(TokenType.COLON) && !this.check(TokenType.RIGHT_PAREN)) {
        do {
          this.parseAsmConstraint();
          if (this.match(TokenType.LEFT_PAREN)) {
            this.parseExpression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after asm expression");
          }
        } while (this.match(TokenType.COMMA));
      }
    }
    
    // Parse optional clobbered registers (starts with ':')
    if (this.match(TokenType.COLON)) {
      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          this.parseAsmConstraint();
        } while (this.match(TokenType.COMMA));
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
    const attributeToken = this.previous();
    let attributeContent = attributeToken.value;
    
    // GCC attributes use __attribute__((...))
    if (this.match(TokenType.LEFT_PAREN)) {
      attributeContent += '(';
      let parenCount = 1;
      while (parenCount > 0 && !this.isAtEnd()) {
        if (this.match(TokenType.LEFT_PAREN)) {
          parenCount++;
          attributeContent += '(';
        } else if (this.match(TokenType.RIGHT_PAREN)) {
          parenCount--;
          attributeContent += ')';
        } else {
          attributeContent += this.advance().value;
        }
      }
    }
    
    // Attributes might be followed by a semicolon or might be part of a declaration
    if (this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
    
    return {
      type: NodeType.ATTRIBUTE_STMT,
      attribute: attributeContent,
      line: attributeToken.line,
      column: attributeToken.column,
    };
  }

  private parseAttributeInDeclaration(): void {
    const attributeToken = this.previous();
    let attributeContent = attributeToken.value;
    
    // GCC attributes use __attribute__((...))
    if (this.match(TokenType.LEFT_PAREN)) {
      attributeContent += '(';
      let parenCount = 1;
      while (parenCount > 0 && !this.isAtEnd()) {
        if (this.match(TokenType.LEFT_PAREN)) {
          parenCount++;
          attributeContent += '(';
        } else if (this.match(TokenType.RIGHT_PAREN)) {
          parenCount--;
          attributeContent += ')';
        } else {
          attributeContent += this.advance().value;
        }
      }
    }
    
    // In declaration context, don't consume the semicolon - let the caller handle it
    // We just parse and ignore the attribute for now
  }

  private parsePreprocessor(): PreprocessorNode {
    const content = this.previous().value;
    const parts = content.split(/\s+/);
    const directive = parts[0];
    
    // Handle include directives
    if (directive === '#include') {
      // For now, just ignore includes - the headers should be preprocessed by gcc when needed
      return {
        type: NodeType.PREPROCESSOR_STMT,
        directive,
        content: content.substring(1),
        line: this.previous().line,
        column: this.previous().column,
      };
    }
    
    // Handle conditional directives
    if (directive === '#if') {
      if (parts[1] === 'X64') {
        // Treat X64 as true, continue parsing normally
        return {
          type: NodeType.PREPROCESSOR_STMT,
          directive,
          content: content.substring(1),
          line: this.previous().line,
          column: this.previous().column,
        };
      }
    } else if (directive === '#else') {
      // Skip until #endif
      while (!this.isAtEnd() && !this.check(TokenType.PREPROCESSOR)) {
        this.advance();
      }
      if (this.check(TokenType.PREPROCESSOR)) {
        const nextContent = this.peek().value;
        if (nextContent.startsWith('#endif')) {
          this.advance(); // Consume #endif
        }
      }
      return {
        type: NodeType.PREPROCESSOR_STMT,
        directive,
        content: content.substring(1),
        line: this.previous().line,
        column: this.previous().column,
      };
    } else if (directive === '#endif') {
      return {
        type: NodeType.PREPROCESSOR_STMT,
        directive,
        content: content.substring(1),
        line: this.previous().line,
        column: this.previous().column,
      };
    }
    
    return {
      type: NodeType.PREPROCESSOR_STMT,
      directive,
      content: content.substring(1), // Remove #
      line: this.previous().line,
      column: this.previous().column,
    };
  }

  private parseTypedef(): TypedefDeclarationNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    // Parse the original type
    const originalType = this.parseTypeSpecifier();
    
    // Get the alias name
    const aliasToken = this.consume(TokenType.IDENTIFIER, 'Expected typedef alias name');
    const alias = aliasToken.value;
    
    this.consume(TokenType.SEMICOLON, "Expected ';' after typedef");
    
    // Store the typedef mapping
    this.typedefs.set(alias, originalType);
    
    return {
      type: NodeType.TYPEDEF_DECLARATION,
      originalType,
      alias,
      line,
      column,
    };
  }

  private parseSwitchStatement(): SwitchStatementNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after switch");
    const expression = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after switch expression");
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' to start switch body");
    
    const cases: CaseStatementNode[] = [];
    let defaultCase: DefaultStatementNode | undefined;
    
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      if (this.match(TokenType.CASE)) {
        const caseValue = this.parseExpression();
        this.consume(TokenType.COLON, "Expected ':' after case value");
        
        const caseStatements: StatementNode[] = [];
        while (!this.check(TokenType.CASE) && !this.check(TokenType.DEFAULT) && 
               !this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
          if (this.check(TokenType.NEWLINE)) {
            this.advance();
            continue;
          }
          caseStatements.push(this.parseStatement());
        }
        
        cases.push({
          type: NodeType.CASE_STATEMENT,
          value: caseValue,
          statements: caseStatements,
          line: caseValue.line,
          column: caseValue.column,
        });
      } else if (this.match(TokenType.DEFAULT)) {
        this.consume(TokenType.COLON, "Expected ':' after default");
        
        const defaultStatements: StatementNode[] = [];
        while (!this.check(TokenType.CASE) && !this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
          if (this.check(TokenType.NEWLINE)) {
            this.advance();
            continue;
          }
          defaultStatements.push(this.parseStatement());
        }
        
        defaultCase = {
          type: NodeType.DEFAULT_STATEMENT,
          statements: defaultStatements,
          line: this.previous().line,
          column: this.previous().column,
        };
      } else {
        // Regular statement in switch (error in C, but we'll allow it for now)
        this.parseStatement();
      }
    }
    
    this.consume(TokenType.RIGHT_BRACE, "Expected '}' to end switch body");
    
    return {
      type: NodeType.SWITCH_STATEMENT,
      expression,
      cases,
      defaultCase,
      line,
      column,
    };
  }
}