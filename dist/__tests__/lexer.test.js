"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lexer_1 = require("../lexer/Lexer");
describe('Lexer', () => {
    describe('Basic tokenization', () => {
        it('should tokenize keywords', () => {
            const lexer = new Lexer_1.Lexer('int char void if else while for return struct');
            const tokens = lexer.tokenize();
            expect(tokens).toHaveLength(10); // 9 keywords + EOF
            expect(tokens[0].type).toBe(Lexer_1.TokenType.INT);
            expect(tokens[1].type).toBe(Lexer_1.TokenType.CHAR);
            expect(tokens[2].type).toBe(Lexer_1.TokenType.VOID);
            expect(tokens[3].type).toBe(Lexer_1.TokenType.IF);
            expect(tokens[4].type).toBe(Lexer_1.TokenType.ELSE);
            expect(tokens[5].type).toBe(Lexer_1.TokenType.WHILE);
            expect(tokens[6].type).toBe(Lexer_1.TokenType.FOR);
            expect(tokens[7].type).toBe(Lexer_1.TokenType.RETURN);
            expect(tokens[8].type).toBe(Lexer_1.TokenType.STRUCT);
            expect(tokens[9].type).toBe(Lexer_1.TokenType.EOF);
        });
        it('should tokenize identifiers', () => {
            const lexer = new Lexer_1.Lexer('main myVar _temp var123');
            const tokens = lexer.tokenize();
            expect(tokens).toHaveLength(5); // 4 identifiers + EOF
            expect(tokens.map(t => t.value)).toEqual(['main', 'myVar', '_temp', 'var123', '']);
            expect(tokens[0].type).toBe(Lexer_1.TokenType.IDENTIFIER);
            expect(tokens[3].type).toBe(Lexer_1.TokenType.IDENTIFIER);
        });
        it('should tokenize numbers', () => {
            const lexer = new Lexer_1.Lexer('42 0 123456');
            const tokens = lexer.tokenize();
            expect(tokens).toHaveLength(4); // 3 numbers + EOF
            expect(tokens.map(t => t.value)).toEqual(['42', '0', '123456', '']);
            expect(tokens[0].type).toBe(Lexer_1.TokenType.NUMBER);
            expect(tokens[2].type).toBe(Lexer_1.TokenType.NUMBER);
        });
        it('should tokenize strings and characters', () => {
            const lexer = new Lexer_1.Lexer('"hello world" \'a\'');
            const tokens = lexer.tokenize();
            expect(tokens).toHaveLength(3); // string + char + EOF
            expect(tokens[0].type).toBe(Lexer_1.TokenType.STRING);
            expect(tokens[0].value).toBe('"hello world"');
            expect(tokens[1].type).toBe(Lexer_1.TokenType.CHARACTER);
            expect(tokens[1].value).toBe("'a'");
        });
    });
    describe('Operators', () => {
        it('should tokenize arithmetic operators', () => {
            const lexer = new Lexer_1.Lexer('+ - * / %');
            const tokens = lexer.tokenize();
            const operatorTokens = tokens.slice(0, -1); // Remove EOF
            const expectedTypes = [Lexer_1.TokenType.PLUS, Lexer_1.TokenType.MINUS, Lexer_1.TokenType.MULTIPLY, Lexer_1.TokenType.DIVIDE, Lexer_1.TokenType.MODULO];
            operatorTokens.forEach((token, i) => {
                expect(token.type).toBe(expectedTypes[i]);
            });
        });
        it('should tokenize comparison operators', () => {
            const lexer = new Lexer_1.Lexer('== != < > <= >=');
            const tokens = lexer.tokenize();
            const operatorTokens = tokens.slice(0, -1); // Remove EOF
            const expectedTypes = [Lexer_1.TokenType.EQUAL, Lexer_1.TokenType.NOT_EQUAL, Lexer_1.TokenType.LESS_THAN, Lexer_1.TokenType.GREATER_THAN, Lexer_1.TokenType.LESS_EQUAL, Lexer_1.TokenType.GREATER_EQUAL];
            operatorTokens.forEach((token, i) => {
                expect(token.type).toBe(expectedTypes[i]);
            });
        });
        it('should tokenize logical operators', () => {
            const lexer = new Lexer_1.Lexer('&& || ! & | ^ << >>');
            const tokens = lexer.tokenize();
            const operatorTokens = tokens.slice(0, -1); // Remove EOF
            const expectedTypes = [Lexer_1.TokenType.AND, Lexer_1.TokenType.OR, Lexer_1.TokenType.NOT, Lexer_1.TokenType.BITWISE_AND, Lexer_1.TokenType.BITWISE_OR, Lexer_1.TokenType.BITWISE_XOR, Lexer_1.TokenType.LEFT_SHIFT, Lexer_1.TokenType.RIGHT_SHIFT];
            operatorTokens.forEach((token, i) => {
                expect(token.type).toBe(expectedTypes[i]);
            });
        });
    });
    describe('Delimiters and brackets', () => {
        it('should tokenize delimiters', () => {
            const lexer = new Lexer_1.Lexer('; , . : ?');
            const tokens = lexer.tokenize();
            const operatorTokens = tokens.slice(0, -1); // Remove EOF
            const expectedTypes = [Lexer_1.TokenType.SEMICOLON, Lexer_1.TokenType.COMMA, Lexer_1.TokenType.DOT, Lexer_1.TokenType.COLON, Lexer_1.TokenType.QUESTION];
            operatorTokens.forEach((token, i) => {
                expect(token.type).toBe(expectedTypes[i]);
            });
        });
        it('should tokenize brackets', () => {
            const lexer = new Lexer_1.Lexer('( ) { } [ ]');
            const tokens = lexer.tokenize();
            const operatorTokens = tokens.slice(0, -1); // Remove EOF
            const expectedTypes = [Lexer_1.TokenType.LEFT_PAREN, Lexer_1.TokenType.RIGHT_PAREN, Lexer_1.TokenType.LEFT_BRACE, Lexer_1.TokenType.RIGHT_BRACE, Lexer_1.TokenType.LEFT_BRACKET, Lexer_1.TokenType.RIGHT_BRACKET];
            operatorTokens.forEach((token, i) => {
                expect(token.type).toBe(expectedTypes[i]);
            });
        });
    });
    describe('Complex C code', () => {
        it('should tokenize a simple function', () => {
            const code = `
int main() {
    int x = 42;
    if (x > 0) {
        return x;
    }
    return 0;
}
`;
            const lexer = new Lexer_1.Lexer(code);
            const tokens = lexer.tokenize();
            // Check that we get tokens without throwing an error
            expect(tokens.length).toBeGreaterThan(10);
            expect(tokens[tokens.length - 1].type).toBe(Lexer_1.TokenType.EOF);
        });
        it('should track line and column numbers', () => {
            const lexer = new Lexer_1.Lexer('int x;\nint y;');
            const tokens = lexer.tokenize();
            // First semicolon should be on line 1
            expect(tokens[2].line).toBe(1);
            expect(tokens[2].column).toBe(6);
            // Second semicolon should be on line 2
            expect(tokens[5].line).toBe(2);
            expect(tokens[5].column).toBe(6);
        });
    });
    describe('Error handling', () => {
        it('should throw on unexpected characters', () => {
            const lexer = new Lexer_1.Lexer('int @var;');
            expect(() => lexer.tokenize()).toThrow('Unexpected character: @');
        });
        it('should handle escape sequences in strings', () => {
            const lexer = new Lexer_1.Lexer('"hello\\nworld"');
            const tokens = lexer.tokenize();
            expect(tokens).toHaveLength(2);
            expect(tokens[0].type).toBe(Lexer_1.TokenType.STRING);
            expect(tokens[0].value).toBe('"hello\\nworld"');
        });
    });
});
