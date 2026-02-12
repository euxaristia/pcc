import { Lexer } from '../lexer/Lexer';
import { Parser, NodeType } from '../parser/Parser';

describe('Advanced Features', () => {
  const parse = (code: string) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  };

  describe('Anonymous Structs and Unions', () => {
    it('should parse anonymous struct member', () => {
      const code = `
struct Outer {
    struct {
        int x;
        int y;
    } inner;
    int z;
};
`;
      const ast = parse(code);
      expect(ast.declarations).toHaveLength(1);
      const structDecl = ast.declarations[0] as any;
      // Note: parseDeclaration for a struct definition without variable returns null if it's followed by ;
      // Wait, let's check how top-level struct definitions are handled.
    });

    it('should parse anonymous union', () => {
      const code = `
struct Data {
    union {
        int i;
        float f;
    };
    int type;
};
`;
      const ast = parse(code);
      expect(ast.declarations).toHaveLength(1);
    });
  });

  describe('Designated Initializers', () => {
    it('should parse array designated initializers', () => {
      const code = 'int arr[3] = { [0] = 1, [2] = 3 };';
      const ast = parse(code);
      const decl = ast.declarations[0] as any;
      expect(decl.initializer.type).toBe(NodeType.INITIALIZER_LIST);
      expect(decl.initializer.initializers[0].designator).toBeDefined();
    });

    it('should parse struct designated initializers', () => {
      const code = 'struct Point p = { .x = 10, .y = 20 };';
      const ast = parse(code);
      const decl = ast.declarations[0] as any;
      expect(decl.initializer.type).toBe(NodeType.INITIALIZER_LIST);
      expect(decl.initializer.initializers[0].designator).toBe('x');
    });
  });
});
