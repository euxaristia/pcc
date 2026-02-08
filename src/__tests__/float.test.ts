
import { Lexer } from '../lexer/Lexer';
import { Parser } from '../parser/Parser';
import { SemanticAnalyzer } from '../semantic/SemanticAnalyzer';
import { IRGenerator } from '../codegen/IRGenerator';
import { generateX8664Assembly } from '../codegen/AssemblyGenerator';

describe('Floating Point Support', () => {
  const compile = (code: string) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const analyzer = new SemanticAnalyzer();
    const errors = analyzer.analyze(ast);
    if (errors.length > 0) {
      throw new Error(errors[0].message);
    }
    const irGenerator = new IRGenerator();
    const ir = irGenerator.generate(ast);
    const assembly = generateX8664Assembly(ir);
    return { ir, assembly };
  };

  test('should compile basic float addition', () => {
    const code = `
      float add(float a, float b) {
        return a + b;
      }
    `;
    const { assembly } = compile(code);
    expect(assembly).toContain('addss');
    expect(assembly).toContain('xmm0');
    expect(assembly).toContain('xmm1');
  });

  test('should compile double multiplication', () => {
    const code = `
      double mul(double a, double b) {
        return a * b;
      }
    `;
    const { assembly } = compile(code);
    expect(assembly).toContain('mulsd');
    expect(assembly).toContain('xmm0');
    expect(assembly).toContain('xmm1');
  });

  test('should compile float comparison', () => {
    const code = `
      int compare(float a, float b) {
        if (a < b) return 1;
        return 0;
      }
    `;
    const { assembly } = compile(code);
    expect(assembly).toContain('ucomiss');
    expect(assembly).toContain('setb');
  });

  test('should handle float literals', () => {
    const code = `
      float get_pi() {
        return 3.14159f;
      }
    `;
    const { ir, assembly } = compile(code);
    // Note: our current IRGenerator might treat all . literals as F64 unless we improve it
    // But it should at least compile.
    expect(assembly).toContain('3.14159');
  });

  test('should compile long addition', () => {
    const code = `
      long add(long a, long b) {
        return a + b;
      }
    `;
    const { assembly } = compile(code);
    expect(assembly).toContain('add');
    expect(assembly).toContain('rax');
  });

  test('should handle long literals', () => {
    const code = `
      long get_large() {
        return 123456789012345L;
      }
    `;
    const { assembly } = compile(code);
    expect(assembly).toContain('123456789012345');
  });
});
