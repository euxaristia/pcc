"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Keywords
    TokenType["INT"] = "int";
    TokenType["CHAR"] = "char";
    TokenType["VOID"] = "void";
    TokenType["IF"] = "if";
    TokenType["ELSE"] = "else";
    TokenType["WHILE"] = "while";
    TokenType["FOR"] = "for";
    TokenType["RETURN"] = "return";
    TokenType["STRUCT"] = "struct";
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
            ['if', TokenType.IF],
            ['else', TokenType.ELSE],
            ['while', TokenType.WHILE],
            ['for', TokenType.FOR],
            ['return', TokenType.RETURN],
            ['struct', TokenType.STRUCT],
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
    readNumber() {
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
            default: throw new Error(`Unknown operator: ${value}`);
        }
    }
    nextToken() {
        this.skipWhitespace();
        if (this.position >= this.input.length) {
            return {
                type: TokenType.EOF,
                value: '',
                line: this.line,
                column: this.column,
            };
        }
        const char = this.peek();
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
        if (/[+\-*/%=!<>&|^?:;,.()\[\]{}]/.test(char)) {
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
