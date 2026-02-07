export enum TokenType {
  // Keywords
  INT = 'int',
  CHAR = 'char',
  VOID = 'void',
  IF = 'if',
  ELSE = 'else',
  WHILE = 'while',
  FOR = 'for',
  RETURN = 'return',
  STRUCT = 'struct',
  ASM = 'asm',
  VOLATILE = 'volatile',
  EXPORT_SYMBOL = 'EXPORT_SYMBOL',
  INIT = '__init',
  
  // Identifiers and literals
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  CHARACTER = 'CHARACTER',
  
  // Operators
  PLUS = '+',
  MINUS = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
  MODULO = '%',
  ASSIGN = '=',
  EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS_THAN = '<',
  GREATER_THAN = '>',
  LESS_EQUAL = '<=',
  GREATER_EQUAL = '>=',
  AND = '&&',
  OR = '||',
  NOT = '!',
  BITWISE_AND = '&',
  BITWISE_OR = '|',
  BITWISE_XOR = '^',
  LEFT_SHIFT = '<<',
  RIGHT_SHIFT = '>>',
  INCREMENT = '++',
  DECREMENT = '--',
  
  // Delimiters
  SEMICOLON = ';',
  COMMA = ',',
  DOT = '.',
  COLON = ':',
  QUESTION = '?',
  
  // Brackets
  LEFT_PAREN = '(',
  RIGHT_PAREN = ')',
  LEFT_BRACE = '{',
  RIGHT_BRACE = '}',
  LEFT_BRACKET = '[',
  RIGHT_BRACKET = ']',
  
  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE',
  
  // Preprocessor
  HASH = '#',
  PREPROCESSOR = 'PREPROCESSOR',
  
  // Additional operators and keywords
  TILDE = '~',
  STATIC = 'static',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  
  private keywords: Map<string, TokenType> = new Map([
    ['int', TokenType.INT],
    ['char', TokenType.CHAR],
    ['void', TokenType.VOID],
    ['if', TokenType.IF],
    ['else', TokenType.ELSE],
    ['while', TokenType.WHILE],
    ['for', TokenType.FOR],
    ['return', TokenType.RETURN],
    ['struct', TokenType.STRUCT],
    ['asm', TokenType.ASM],
    ['__asm__', TokenType.ASM],
    ['volatile', TokenType.VOLATILE],
    ['__volatile__', TokenType.VOLATILE],
    ['EXPORT_SYMBOL', TokenType.EXPORT_SYMBOL],
    ['__init', TokenType.INIT],
    ['static', TokenType.STATIC],
  ]);

  constructor(input: string) {
    this.input = input;
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos]! : '\0';
  }

  private advance(): string {
    const char = this.peek();
    this.position++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek()) && this.peek() !== '\0') {
      this.advance();
    }
  }

  private skipSingleLineComment(): void {
    while (this.peek() !== '\n' && this.peek() !== '\0') {
      this.advance();
    }
  }

  private skipMultiLineComment(): void {
    this.advance(); // Skip '*'
    while (!(this.peek() === '*' && this.peek(1) === '/') && this.peek() !== '\0') {
      this.advance();
    }
    this.advance(); // Skip '*'
    this.advance(); // Skip '/'
  }

  private skipPreprocessorDirective(): void {
    while (this.peek() !== '\n' && this.peek() !== '\0') {
      this.advance();
    }
  }

  private readPreprocessorDirective(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip '#'
    
    // Read the rest of the line (until newline or EOF)
    while (this.peek() !== '\n' && this.peek() !== '\0') {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    return {
      type: TokenType.PREPROCESSOR,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readNumber(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    while (/\d/.test(this.peek())) {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    return {
      type: TokenType.NUMBER,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    while (/[a-zA-Z_]/.test(this.peek()) || (this.position > start && /\d/.test(this.peek()))) {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    const type = this.keywords.get(value) || TokenType.IDENTIFIER;
    
    return {
      type,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readString(quote: string): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip opening quote
    
    while (this.peek() !== quote && this.peek() !== '\0') {
      if (this.peek() === '\\') {
        this.advance(); // Skip escape character
      }
      this.advance();
    }
    
    if (this.peek() === quote) {
      this.advance(); // Skip closing quote
    }
    
    const value = this.input.substring(start, this.position);
    return {
      type: quote === '"' ? TokenType.STRING : TokenType.CHARACTER,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readOperator(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    const char = this.advance();
    const next = this.peek();
    
    // Two-character operators
    if ((char === '=' && next === '=') ||
        (char === '!' && next === '=') ||
        (char === '<' && next === '=') ||
        (char === '>' && next === '=') ||
        (char === '&' && next === '&') ||
        (char === '|' && next === '|') ||
        (char === '<' && next === '<') ||
        (char === '>' && next === '>') ||
        (char === '+' && next === '+') ||
        (char === '-' && next === '-')) {
      this.advance();
      const value = this.input.substring(start, this.position);
      return {
        type: this.getOperatorTokenType(value),
        value,
        line: startLine,
        column: startColumn,
      };
    }
    
    // Single-character operators
    return {
      type: this.getOperatorTokenType(char),
      value: char,
      line: startLine,
      column: startColumn,
    };
  }

  private getOperatorTokenType(value: string): TokenType {
    switch (value) {
      case '+': return TokenType.PLUS;
      case '-': return TokenType.MINUS;
      case '*': return TokenType.MULTIPLY;
      case '/': return TokenType.DIVIDE;
      case '%': return TokenType.MODULO;
      case '=': return TokenType.ASSIGN;
      case '==': return TokenType.EQUAL;
      case '!=': return TokenType.NOT_EQUAL;
      case '<': return TokenType.LESS_THAN;
      case '>': return TokenType.GREATER_THAN;
      case '<=': return TokenType.LESS_EQUAL;
      case '>=': return TokenType.GREATER_EQUAL;
      case '&&': return TokenType.AND;
      case '||': return TokenType.OR;
      case '!': return TokenType.NOT;
      case '&': return TokenType.BITWISE_AND;
      case '|': return TokenType.BITWISE_OR;
      case '^': return TokenType.BITWISE_XOR;
      case '<<': return TokenType.LEFT_SHIFT;
      case '>>': return TokenType.RIGHT_SHIFT;
      case '++': return TokenType.INCREMENT;
      case '--': return TokenType.DECREMENT;
      case ';': return TokenType.SEMICOLON;
      case ',': return TokenType.COMMA;
      case '.': return TokenType.DOT;
      case ':': return TokenType.COLON;
      case '?': return TokenType.QUESTION;
      case '(': return TokenType.LEFT_PAREN;
      case ')': return TokenType.RIGHT_PAREN;
      case '{': return TokenType.LEFT_BRACE;
      case '}': return TokenType.RIGHT_BRACE;
      case '[': return TokenType.LEFT_BRACKET;
      case ']': return TokenType.RIGHT_BRACKET;
      case '#': return TokenType.HASH;
      default: throw new Error(`Unknown operator: ${value}`);
    }
  }

  public nextToken(): Token {
    // Skip whitespace first
    this.skipWhitespace();
    
    // Check for preprocessor directives at the beginning of line (no leading whitespace)
    if (this.column === 1 && this.peek() === '#') {
      this.skipPreprocessorDirective();
      return this.nextToken();
    }
    
    if (this.position >= this.input.length) {
      return {
        type: TokenType.EOF,
        value: '',
        line: this.line,
        column: this.column,
      };
    }
    
    const char = this.peek();
    
    // Handle comments
    if (char === '/' && this.peek(1) === '/') {
      this.skipSingleLineComment();
      return this.nextToken();
    }
    
    if (char === '/' && this.peek(1) === '*') {
      this.skipMultiLineComment();
      return this.nextToken();
    }
    
    // Skip whitespace and call again if we hit whitespace
    if (/\s/.test(char) && char !== '\n') {
      this.skipWhitespace();
      return this.nextToken();
    }
    
    if (/\d/.test(char)) {
      return this.readNumber();
    }
    
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier();
    }
    
    if (char === '"' || char === "'") {
      return this.readString(char);
    }
    
    if (/[+\-*/%=!<>&|^?:;,.()\[\]{}#]/.test(char)) {
      return this.readOperator();
    }
    
    if (char === '\n') {
      const token = {
        type: TokenType.NEWLINE,
        value: '\n',
        line: this.line,
        column: this.column,
      };
      this.advance();
      return token;
    }
    
    throw new Error(`Unexpected character: ${char} at line ${this.line}, column ${this.column}`);
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    
    tokens.push(token); // Add EOF token
    return tokens;
  }
}