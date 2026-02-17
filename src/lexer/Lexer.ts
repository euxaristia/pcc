export enum TokenType {
  // Keywords
  INT = 'int',
  CHAR = 'char',
  VOID = 'void',
  LONG = 'long',
  SHORT = 'short',
  UNSIGNED = 'unsigned',
  SIGNED = 'signed',
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
  SIZEOF = 'sizeof',
  TYPEDEF = 'typedef',
  SWITCH = 'switch',
  CASE = 'case',
  DEFAULT = 'default',
  BREAK = 'break',
  CONTINUE = 'continue',
  ENUM = 'enum',
  UNION = 'union',
  EXTERN = 'extern',
  CONST = 'const',
  INLINE = 'inline',
  DO = 'do',
  GOTO = 'goto',
  REGISTER = 'register',
  AUTO = 'auto',
  BOOL = '_Bool',
  FLOAT = 'float',
  DOUBLE = 'double',
  RESTRICT = 'restrict',
  NORETURN = '_Noreturn',
  ALIGNAS = '_Alignas',
  ALIGNOF = '_Alignof',
  STATIC_ASSERT = '_Static_assert',
  THREAD_LOCAL = '_Thread_local',
  ATTRIBUTE = '__attribute__',
  EXTENSION = '__extension__',
  TYPEOF = '__typeof__',
  UNDERSCORE_INLINE = '__inline__',
  UNDERSCORE_RESTRICT = '__restrict__',
  
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
  
  // Compound assignment operators
  PLUS_ASSIGN = '+=',
  MINUS_ASSIGN = '-=',
  MULTIPLY_ASSIGN = '*=',
  DIVIDE_ASSIGN = '/=',
  MODULO_ASSIGN = '%=',
  AND_ASSIGN = '&=',
  OR_ASSIGN = '|=',
  XOR_ASSIGN = '^=',
  LEFT_SHIFT_ASSIGN = '<<=',
  RIGHT_SHIFT_ASSIGN = '>>=',
  
  // Arrow operator
  ARROW = '->',
  
  // Ellipsis
  ELLIPSIS = '...',
  
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
    ['long', TokenType.LONG],
    ['short', TokenType.SHORT],
    ['unsigned', TokenType.UNSIGNED],
    ['signed', TokenType.SIGNED],
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
    ['sizeof', TokenType.SIZEOF],
    ['typedef', TokenType.TYPEDEF],
    ['switch', TokenType.SWITCH],
    ['case', TokenType.CASE],
    ['default', TokenType.DEFAULT],
    ['break', TokenType.BREAK],
    ['continue', TokenType.CONTINUE],
    ['enum', TokenType.ENUM],
    ['union', TokenType.UNION],
    ['extern', TokenType.EXTERN],
    ['const', TokenType.CONST],
    ['inline', TokenType.INLINE],
    ['__inline__', TokenType.UNDERSCORE_INLINE],
    ['do', TokenType.DO],
    ['goto', TokenType.GOTO],
    ['register', TokenType.REGISTER],
    ['auto', TokenType.AUTO],
    ['_Bool', TokenType.BOOL],
    ['float', TokenType.FLOAT],
    ['double', TokenType.DOUBLE],
    ['restrict', TokenType.RESTRICT],
    ['__restrict__', TokenType.UNDERSCORE_RESTRICT],
    ['_Noreturn', TokenType.NORETURN],
    ['_Alignas', TokenType.ALIGNAS],
    ['_Alignof', TokenType.ALIGNOF],
    ['_Static_assert', TokenType.STATIC_ASSERT],
    ['_Thread_local', TokenType.THREAD_LOCAL],
    ['__attribute__', TokenType.ATTRIBUTE],
    ['__extension__', TokenType.EXTENSION],
    ['__typeof__', TokenType.TYPEOF],
    ['typeof', TokenType.TYPEOF],
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
    // Check if this is a line marker: # 123 "file.c"
    // '#' is already peeked but not advanced in nextToken
    this.advance(); // Skip '#'
    
    // Skip optional spaces
    while (this.peek() === ' ' || this.peek() === '\t') {
      this.advance();
    }
    
    // If it's a digit, it's a line marker
    if (/\d/.test(this.peek())) {
      let lineStr = '';
      while (/\d/.test(this.peek())) {
        lineStr += this.advance();
      }
      const newLine = parseInt(lineStr, 10);
      if (!isNaN(newLine)) {
        this.line = newLine - 1; // -1 because the next \n will increment it
        this.column = 1;
      }
    }

    while (this.peek() !== '\n' && this.peek() !== '\0') {
      this.advance();
    }
    if (this.peek() === '\n') {
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
    
    // Check for hex (0x) or octal (0) prefix
    if (this.peek() === '0') {
      this.advance();
      if (this.peek() === 'x' || this.peek() === 'X') {
        // Hexadecimal
        this.advance();
        while (/[0-9a-fA-F]/.test(this.peek())) {
          this.advance();
        }
      } else if (/[0-7]/.test(this.peek())) {
        // Octal
        while (/[0-7]/.test(this.peek())) {
          this.advance();
        }
      }
      // Just a single '0' - that's valid decimal 0
    } else {
      // Regular decimal number
      while (/\d/.test(this.peek())) {
        this.advance();
      }
      
      // Check for decimal point
      if (this.peek() === '.') {
        this.advance();
        while (/\d/.test(this.peek())) {
          this.advance();
        }
      }
      
      // Check for scientific notation
      if (this.peek() === 'e' || this.peek() === 'E') {
        this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          this.advance();
        }
        while (/\d/.test(this.peek())) {
          this.advance();
        }
      }
    }
    
    // Handle suffixes (U, L, LL, f, etc.)
    if (this.peek() === 'f' || this.peek() === 'F') {
      this.advance();
    } else if (this.peek() === 'u' || this.peek() === 'U') {
      this.advance();
      if (this.peek() === 'l' || this.peek() === 'L') {
        this.advance();
        if (this.peek() === 'l' || this.peek() === 'L') {
          this.advance();
        }
      }
    } else if (this.peek() === 'l' || this.peek() === 'L') {
      this.advance();
      if (this.peek() === 'l' || this.peek() === 'L') {
        this.advance();
      }
      if (this.peek() === 'u' || this.peek() === 'U') {
        this.advance();
      }
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
        (char === '+' && next === '+') ||
        (char === '-' && next === '-') ||
        (char === '-' && next === '>') ||
        (char === '+' && next === '=') ||
        (char === '-' && next === '=') ||
        (char === '*' && next === '=') ||
        (char === '/' && next === '=') ||
        (char === '%' && next === '=') ||
        (char === '&' && next === '=') ||
        (char === '|' && next === '=') ||
        (char === '^' && next === '=')) {
      this.advance();
      const value = this.input.substring(start, this.position);
      return {
        type: this.getOperatorTokenType(value),
        value,
        line: startLine,
        column: startColumn,
      };
    }
    
    // Three-character operators (<<=, >>=, and ellipsis) - must check before << and >>
    // Note: peek(1) because after advance(), position is at the second char
    // We only advance() twice - once for the second char and once for the third char
    // The initial advance() at the start of readOperator() already consumed the first char
    if ((char === '<' && next === '<' && this.peek(1) === '=') ||
        (char === '>' && next === '>' && this.peek(1) === '=')) {
      this.advance();  // consume second char
      this.advance();  // consume third char
      const value = this.input.substring(start, this.position);
      return {
        type: this.getOperatorTokenType(value),
        value,
        line: startLine,
        column: startColumn,
      };
    }
    
    // Two-character shift operators (<<, >>) - must check after <<= and >>
    if ((char === '<' && next === '<') ||
        (char === '>' && next === '>')) {
      this.advance();
      const value = this.input.substring(start, this.position);
      return {
        type: this.getOperatorTokenType(value),
        value,
        line: startLine,
        column: startColumn,
      };
    }
    
    // Ellipsis (...)
    // Note: peek(1) because after advance(), position is at the second char
    if (char === '.' && next === '.' && this.peek(1) === '.') {
      this.advance();  // consume second '.'
      this.advance();  // consume third '.'
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
      case '~': return TokenType.TILDE;
      case '<<': return TokenType.LEFT_SHIFT;
      case '>>': return TokenType.RIGHT_SHIFT;
      case '++': return TokenType.INCREMENT;
      case '--': return TokenType.DECREMENT;
      case '+=': return TokenType.PLUS_ASSIGN;
      case '-=': return TokenType.MINUS_ASSIGN;
      case '*=': return TokenType.MULTIPLY_ASSIGN;
      case '/=': return TokenType.DIVIDE_ASSIGN;
      case '%=': return TokenType.MODULO_ASSIGN;
      case '&=': return TokenType.AND_ASSIGN;
      case '|=': return TokenType.OR_ASSIGN;
      case '^=': return TokenType.XOR_ASSIGN;
      case '<<=': return TokenType.LEFT_SHIFT_ASSIGN;
      case '>>=': return TokenType.RIGHT_SHIFT_ASSIGN;
      case '->': return TokenType.ARROW;
      case '...': return TokenType.ELLIPSIS;
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
    
    // Handle preprocessor directives (including line markers from preprocessed code)
    if (this.peek() === '#') {
      return this.readPreprocessorDirective();
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
    
    if (/[+\-*/%=!<>&|^?:;,.()\[\]{}#~]/.test(char)) {
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