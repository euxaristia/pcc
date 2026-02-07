import { Lexer, TokenType } from '../lexer/Lexer';

describe('Lexer', () => {
  describe('Basic tokenization', () => {
    it('should tokenize keywords', () => {
      const lexer = new Lexer('int char void if else while for return struct');
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(10); // 9 keywords + EOF
      expect(tokens[0].type).toBe(TokenType.INT);
      expect(tokens[1].type).toBe(TokenType.CHAR);
      expect(tokens[2].type).toBe(TokenType.VOID);
      expect(tokens[3].type).toBe(TokenType.IF);
      expect(tokens[4].type).toBe(TokenType.ELSE);
      expect(tokens[5].type).toBe(TokenType.WHILE);
      expect(tokens[6].type).toBe(TokenType.FOR);
      expect(tokens[7].type).toBe(TokenType.RETURN);
      expect(tokens[8].type).toBe(TokenType.STRUCT);
      expect(tokens[9].type).toBe(TokenType.EOF);
    });

    it('should tokenize identifiers', () => {
      const lexer = new Lexer('main myVar _temp var123');
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(5); // 4 identifiers + EOF
      expect(tokens.map(t => t.value)).toEqual(['main', 'myVar', '_temp', 'var123', '']);
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
    });

    it('should tokenize numbers', () => {
      const lexer = new Lexer('42 0 123456');
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(4); // 3 numbers + EOF
      expect(tokens.map(t => t.value)).toEqual(['42', '0', '123456', '']);
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
    });

    it('should tokenize strings and characters', () => {
      const lexer = new Lexer('"hello world" \'a\'');
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(3); // string + char + EOF
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('"hello world"');
      expect(tokens[1].type).toBe(TokenType.CHARACTER);
      expect(tokens[1].value).toBe("'a'");
    });
  });

  describe('Operators', () => {
    it('should tokenize arithmetic operators', () => {
      const lexer = new Lexer('+ - * / %');
      const tokens = lexer.tokenize();
      
      const operatorTokens = tokens.slice(0, -1); // Remove EOF
      const expectedTypes = [TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO];
      
      operatorTokens.forEach((token, i) => {
        expect(token.type).toBe(expectedTypes[i]);
      });
    });

    it('should tokenize comparison operators', () => {
      const lexer = new Lexer('== != < > <= >=');
      const tokens = lexer.tokenize();
      
      const operatorTokens = tokens.slice(0, -1); // Remove EOF
      const expectedTypes = [TokenType.EQUAL, TokenType.NOT_EQUAL, TokenType.LESS_THAN, TokenType.GREATER_THAN, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL];
      
      operatorTokens.forEach((token, i) => {
        expect(token.type).toBe(expectedTypes[i]);
      });
    });

    it('should tokenize logical operators', () => {
      const lexer = new Lexer('&& || ! & | ^ << >>');
      const tokens = lexer.tokenize();
      
      const operatorTokens = tokens.slice(0, -1); // Remove EOF
      const expectedTypes = [TokenType.AND, TokenType.OR, TokenType.NOT, TokenType.BITWISE_AND, TokenType.BITWISE_OR, TokenType.BITWISE_XOR, TokenType.LEFT_SHIFT, TokenType.RIGHT_SHIFT];
      
      operatorTokens.forEach((token, i) => {
        expect(token.type).toBe(expectedTypes[i]);
      });
    });
  });

  describe('Delimiters and brackets', () => {
    it('should tokenize delimiters', () => {
      const lexer = new Lexer('; , . : ?');
      const tokens = lexer.tokenize();
      
      const operatorTokens = tokens.slice(0, -1); // Remove EOF
      const expectedTypes = [TokenType.SEMICOLON, TokenType.COMMA, TokenType.DOT, TokenType.COLON, TokenType.QUESTION];
      
      operatorTokens.forEach((token, i) => {
        expect(token.type).toBe(expectedTypes[i]);
      });
    });

    it('should tokenize brackets', () => {
      const lexer = new Lexer('( ) { } [ ]');
      const tokens = lexer.tokenize();
      
      const operatorTokens = tokens.slice(0, -1); // Remove EOF
      const expectedTypes = [TokenType.LEFT_PAREN, TokenType.RIGHT_PAREN, TokenType.LEFT_BRACE, TokenType.RIGHT_BRACE, TokenType.LEFT_BRACKET, TokenType.RIGHT_BRACKET];
      
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
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      
      // Check that we get tokens without throwing an error
      expect(tokens.length).toBeGreaterThan(10);
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });

    it('should track line and column numbers', () => {
      const lexer = new Lexer('int x;\nint y;');
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
      const lexer = new Lexer('int @var;');
      expect(() => lexer.tokenize()).toThrow('Unexpected character: @');
    });

    it('should handle escape sequences in strings', () => {
      const lexer = new Lexer('"hello\\nworld"');
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('"hello\\nworld"');
    });
  });
});