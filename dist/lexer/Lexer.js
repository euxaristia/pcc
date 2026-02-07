"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Keywords
    TokenType["INT"] = "int";
    TokenType["CHAR"] = "char";
    TokenType["VOID"] = "void";
    TokenType["LONG"] = "long";
    TokenType["SHORT"] = "short";
    TokenType["UNSIGNED"] = "unsigned";
    TokenType["SIGNED"] = "signed";
    TokenType["IF"] = "if";
    TokenType["ELSE"] = "else";
    TokenType["WHILE"] = "while";
    TokenType["FOR"] = "for";
    TokenType["RETURN"] = "return";
    TokenType["STRUCT"] = "struct";
    TokenType["ASM"] = "asm";
    TokenType["VOLATILE"] = "volatile";
    TokenType["EXPORT_SYMBOL"] = "EXPORT_SYMBOL";
    TokenType["INIT"] = "__init";
    TokenType["SIZEOF"] = "sizeof";
    TokenType["TYPEDEF"] = "typedef";
    TokenType["SWITCH"] = "switch";
    TokenType["CASE"] = "case";
    TokenType["DEFAULT"] = "default";
    TokenType["BREAK"] = "break";
    TokenType["CONTINUE"] = "continue";
    // Identifiers and literals
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["CHARACTER"] = "CHARACTER";
    // Operators
    TokenType["PLUS"] = "+";
    TokenType["MINUS"] = "-";
    TokenType["MULTIPLY"] = "*";
    TokenType["DIVIDE"] = "/";
    TokenType["MODULO"] = "%";
    TokenType["ASSIGN"] = "=";
    TokenType["EQUAL"] = "==";
    TokenType["NOT_EQUAL"] = "!=";
    TokenType["LESS_THAN"] = "<";
    TokenType["GREATER_THAN"] = ">";
    TokenType["LESS_EQUAL"] = "<=";
    TokenType["GREATER_EQUAL"] = ">=";
    TokenType["AND"] = "&&";
    TokenType["OR"] = "||";
    TokenType["NOT"] = "!";
    TokenType["BITWISE_AND"] = "&";
    TokenType["BITWISE_OR"] = "|";
    TokenType["BITWISE_XOR"] = "^";
    TokenType["LEFT_SHIFT"] = "<<";
    TokenType["RIGHT_SHIFT"] = ">>";
    TokenType["INCREMENT"] = "++";
    TokenType["DECREMENT"] = "--";
    // Delimiters
    TokenType["SEMICOLON"] = ";";
    TokenType["COMMA"] = ",";
    TokenType["DOT"] = ".";
    TokenType["COLON"] = ":";
    TokenType["QUESTION"] = "?";
    // Brackets
    TokenType["LEFT_PAREN"] = "(";
    TokenType["RIGHT_PAREN"] = ")";
    TokenType["LEFT_BRACE"] = "{";
    TokenType["RIGHT_BRACE"] = "}";
    TokenType["LEFT_BRACKET"] = "[";
    TokenType["RIGHT_BRACKET"] = "]";
    // Special
    TokenType["EOF"] = "EOF";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["WHITESPACE"] = "WHITESPACE";
    // Preprocessor
    TokenType["HASH"] = "#";
    TokenType["PREPROCESSOR"] = "PREPROCESSOR";
    // Additional operators and keywords
    TokenType["TILDE"] = "~";
    TokenType["STATIC"] = "static";
})(TokenType || (exports.TokenType = TokenType = {}));
class Lexer {
    constructor(input) {
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.keywords = new Map([
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
        ]);
        this.input = input;
    }
    peek(offset = 0) {
        const pos = this.position + offset;
        return pos < this.input.length ? this.input[pos] : '\0';
    }
    advance() {
        const char = this.peek();
        this.position++;
        if (char === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        return char;
    }
    skipWhitespace() {
        while (/\s/.test(this.peek()) && this.peek() !== '\0') {
            this.advance();
        }
    }
    skipSingleLineComment() {
        while (this.peek() !== '\n' && this.peek() !== '\0') {
            this.advance();
        }
    }
    skipMultiLineComment() {
        this.advance(); // Skip '*'
        while (!(this.peek() === '*' && this.peek(1) === '/') && this.peek() !== '\0') {
            this.advance();
        }
        this.advance(); // Skip '*'
        this.advance(); // Skip '/'
    }
    skipPreprocessorDirective() {
        while (this.peek() !== '\n' && this.peek() !== '\0') {
            this.advance();
        }
    }
    readPreprocessorDirective() {
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
    readNumber() {
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
            }
            else if (/[0-7]/.test(this.peek())) {
                // Octal
                while (/[0-7]/.test(this.peek())) {
                    this.advance();
                }
            }
            // Just a single '0' - that's valid decimal 0
        }
        else {
            // Regular decimal number
            while (/\d/.test(this.peek())) {
                this.advance();
            }
        }
        // Handle suffixes (U, L, LL, UL, ULL, etc.)
        if (this.peek() === 'u' || this.peek() === 'U') {
            this.advance();
            if (this.peek() === 'l' || this.peek() === 'L') {
                this.advance();
                if (this.peek() === 'l' || this.peek() === 'L') {
                    this.advance();
                }
            }
        }
        else if (this.peek() === 'l' || this.peek() === 'L') {
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
    readIdentifier() {
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
    readString(quote) {
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
    readOperator() {
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
    getOperatorTokenType(value) {
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
    nextToken() {
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
    tokenize() {
        const tokens = [];
        let token = this.nextToken();
        while (token.type !== TokenType.EOF) {
            tokens.push(token);
            token = this.nextToken();
        }
        tokens.push(token); // Add EOF token
        return tokens;
    }
}
exports.Lexer = Lexer;
