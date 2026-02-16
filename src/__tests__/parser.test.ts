import { Lexer } from '../lexer/Lexer';
import { Parser, NodeType } from '../parser/Parser';

describe('Parser', () => {
  const parse = (code: string) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  };

  describe('Basic parsing', () => {
    it('should parse a simple function', () => {
      const code = 'int main() { return 0; }';
      const ast = parse(code);
      
      expect(ast.type).toBe(NodeType.PROGRAM);
      expect(ast.declarations).toHaveLength(1);
      
      const func = ast.declarations[0] as any;
      expect(func.type).toBe(NodeType.FUNCTION_DECLARATION);
      expect(func.name).toBe('main');
      expect(func.returnType.typeName).toBe('int');
    });

    it('should parse multiple declarations', () => {
      const code = `
int x;
int y;
int main() { return x + y; }
`;
      const ast = parse(code);
      
      expect(ast.declarations).toHaveLength(3);
      expect(ast.declarations[0].type).toBe(NodeType.DECLARATION);
      expect(ast.declarations[1].type).toBe(NodeType.DECLARATION);
      expect(ast.declarations[2].type).toBe(NodeType.FUNCTION_DECLARATION);
    });
  });

  describe('Function declarations', () => {
    it('should parse function with parameters', () => {
      const code = 'int add(int a, int b) { return a + b; }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0].name).toBe('a');
      expect(func.parameters[0].varType.typeName).toBe('int');
      expect(func.parameters[1].name).toBe('b');
    });

    it('should parse function with no parameters', () => {
      const code = 'void test() { }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      expect(func.parameters).toHaveLength(0);
      expect(func.returnType.typeName).toBe('void');
    });

    it('should parse function with different return types', () => {
      const code = `
char getChar() { return 'a'; }
void doNothing() { }
`;
      const ast = parse(code);
      
      const func1 = ast.declarations[0] as any;
      const func2 = ast.declarations[1] as any;
      
      expect(func1.returnType.typeName).toBe('char');
      expect(func2.returnType.typeName).toBe('void');
    });
  });

  describe('Variable declarations', () => {
    it('should parse simple variable declaration', () => {
      const code = 'int x;';
      const ast = parse(code);
      
      const decl = ast.declarations[0] as any;
      expect(decl.type).toBe(NodeType.DECLARATION);
      expect(decl.name).toBe('x');
      expect(decl.varType.typeName).toBe('int');
      expect(decl.initializer).toBeUndefined();
    });

    it('should parse variable declaration with initializer', () => {
      const code = 'int x = 42;';
      const ast = parse(code);
      
      const decl = ast.declarations[0] as any;
      expect(decl.initializer.type).toBe(NodeType.NUMBER_LITERAL);
      expect(decl.initializer.value).toBe('42');
    });

    it('should parse different types', () => {
      const code = `
char c = 'a';
int n = 123;
`;
      const ast = parse(code);
      
      const charDecl = ast.declarations[0] as any;
      const intDecl = ast.declarations[1] as any;
      
      expect(charDecl.varType.typeName).toBe('char');
      expect(charDecl.initializer.type).toBe(NodeType.CHARACTER_LITERAL);
      expect(intDecl.varType.typeName).toBe('int');
      expect(intDecl.initializer.type).toBe(NodeType.NUMBER_LITERAL);
    });
  });

  describe('Expressions', () => {
    it('should parse binary expressions', () => {
      const code = 'int main() { return 1 + 2 * 3; }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const returnStmt = func.body.statements[0];
      const expr = returnStmt.value;
      
      expect(expr.type).toBe(NodeType.BINARY_EXPRESSION);
      expect(expr.operator).toBe('+');
      expect(expr.left.type).toBe(NodeType.NUMBER_LITERAL);
      expect(expr.right.type).toBe(NodeType.BINARY_EXPRESSION);
      expect(expr.right.operator).toBe('*');
    });

    it('should parse relational expressions', () => {
      const code = 'int main() { return x > y && z <= w; }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const returnStmt = func.body.statements[0];
      const expr = returnStmt.value;
      
      expect(expr.type).toBe(NodeType.BINARY_EXPRESSION);
      expect(expr.operator).toBe('&&');
    });

    it('should parse assignment expressions', () => {
      const code = 'int main() { x = 5; }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const stmt = func.body.statements[0];
      
      expect(stmt.type).toBe(NodeType.EXPRESSION_STATEMENT);
      expect(stmt.expression.type).toBe(NodeType.ASSIGNMENT);
      expect(stmt.expression.target.name).toBe('x');
      expect(stmt.expression.value.type).toBe(NodeType.NUMBER_LITERAL);
    });

    it('should parse function calls', () => {
      const code = 'int main() { foo(1, 2, 3); }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const stmt = func.body.statements[0];
      const call = stmt.expression;
      
      expect(call.type).toBe(NodeType.FUNCTION_CALL);
      expect(call.callee).toBeDefined();
      expect(call.callee.name).toBe('foo');
      expect(call.arguments).toHaveLength(3);
    });
  });

  describe('Control flow', () => {
    it('should parse if statements', () => {
      const code = 'int main() { if (x > 0) { return 1; } else { return 0; } }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const ifStmt = func.body.statements[0];
      
      expect(ifStmt.type).toBe(NodeType.IF_STATEMENT);
      expect(ifStmt.condition.type).toBe(NodeType.BINARY_EXPRESSION);
      expect(ifStmt.elseBranch).toBeDefined();
    });

    it('should parse while statements', () => {
      const code = 'int main() { while (i < 10) { i++; } }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const whileStmt = func.body.statements[0];
      
      expect(whileStmt.type).toBe(NodeType.WHILE_STATEMENT);
      expect(whileStmt.condition.type).toBe(NodeType.BINARY_EXPRESSION);
    });

    it('should parse for statements', () => {
      const code = 'int main() { for (int i = 0; i < 10; i++) { } }';
      const ast = parse(code);
      
      const func = ast.declarations[0] as any;
      const forStmt = func.body.statements[0];
      
      expect(forStmt.type).toBe(NodeType.FOR_STATEMENT);
      expect(forStmt.initialization.type).toBe(NodeType.DECLARATION);
      expect(forStmt.condition.type).toBe(NodeType.BINARY_EXPRESSION);
      expect(forStmt.increment.type).toBe(NodeType.UNARY_EXPRESSION);
      expect(forStmt.increment.operator).toBe('++_post');
    });
  });

  describe('Complex programs', () => {
    it('should parse a complete program with multiple functions', () => {
      const code = `
int factorial(int n) {
    if (n <= 1) {
        return 1;
    } else {
        return n * factorial(n - 1);
    }
}

int main() {
    int result = factorial(5);
    return result;
}
`;
      const ast = parse(code);
      
      expect(ast.declarations).toHaveLength(2);
      expect(ast.declarations[0].type).toBe(NodeType.FUNCTION_DECLARATION);
      expect(ast.declarations[1].type).toBe(NodeType.FUNCTION_DECLARATION);
      
      const factorial = ast.declarations[0] as any;
      expect(factorial.name).toBe('factorial');
      expect(factorial.parameters).toHaveLength(1);
      
      const main = ast.declarations[1] as any;
      expect(main.name).toBe('main');
      expect(main.body.statements).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle missing semicolon gracefully', () => {
      const code = 'int x = 5';
      expect(() => parse(code)).toThrow();
    });

    it('should handle missing braces gracefully', () => {
      const code = 'int main() return 0; }';
      expect(() => parse(code)).toThrow();
    });

    it('should handle invalid syntax', () => {
      const code = 'int main() { x = ; }';
      expect(() => parse(code)).toThrow();
    });
  });
});