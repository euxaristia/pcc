import { Lexer } from '../lexer/Lexer';
import { Parser } from '../parser/Parser';
import { IRGenerator } from '../codegen/IRGenerator';
import { prettyPrintIR } from '../codegen/IR';

describe('IRGenerator', () => {
  const generateIR = (code: string) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const irGen = new IRGenerator();
    return irGen.generate(ast);
  };

  describe('Basic function generation', () => {
    it('should generate IR for a simple function', () => {
      const code = `
int main() {
    return 42;
}
`;
      const ir = generateIR(code);
      
      expect(ir.functions).toHaveLength(1);
      const main = ir.functions[0];
      expect(main.name).toBe('main');
      expect(main.returnType).toBe('i32');
      expect(main.parameters).toHaveLength(0);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('define i32 @main()');
      expect(irString).toContain('ret 42');
    });

    it('should generate IR for function with parameters', () => {
      const code = `
int add(int a, int b) {
    return a + b;
}
`;
      const ir = generateIR(code);
      
      expect(ir.functions).toHaveLength(1);
      const add = ir.functions[0];
      expect(add.name).toBe('add');
      expect(add.parameters).toHaveLength(2);
      expect(add.parameters[0].name).toBe('a');
      expect(add.parameters[1].name).toBe('b');
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('define i32 @add(i32 a, i32 b)');
      expect(irString).toContain('add');
    });
  });

  describe('Variable declarations', () => {
    it('should generate IR for variable declarations', () => {
      const code = `
int main() {
    int x = 5;
    int y = 10;
    return x + y;
}
`;
      const ir = generateIR(code);
      
      const main = ir.functions[0];
      expect(main.locals).toHaveLength(2);
      expect(main.locals.some(l => l.name === 'x')).toBe(true);
      expect(main.locals.some(l => l.name === 'y')).toBe(true);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('alloca i32');
      expect(irString).toContain('store');
      expect(irString).toContain('load');
    });
  });

  describe('Expressions', () => {
    it('should generate IR for binary expressions', () => {
      const code = `
int main() {
    int a = 2;
    int b = 3;
    int c = a + b * 4;
    return c;
}
`;
      const ir = generateIR(code);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('mul');
      expect(irString).toContain('add');
    });

    it('should generate IR for comparison expressions', () => {
      const code = `
int main() {
    int a = 5;
    int b = 3;
    int c = a > b;
    return c;
}
`;
      const ir = generateIR(code);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('gt');
    });

    it('should generate IR for function calls', () => {
      const code = `
int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(5, 3);
    return result;
}
`;
      const ir = generateIR(code);
      
      expect(ir.functions).toHaveLength(2);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('call add');
    });
  });

  describe('Control flow', () => {
    it('should generate IR for if statements', () => {
      const code = `
int main() {
    int x = 5;
    if (x > 0) {
        return 1;
    } else {
        return 0;
    }
}
`;
      const ir = generateIR(code);
      
      const main = ir.functions[0];
      expect(main.body.length).toBeGreaterThan(1); // Should have multiple blocks
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('jump_if');
      expect(irString).toContain('then_');
      expect(irString).toContain('else_');
      expect(irString).toContain('merge_');
    });

    it('should generate IR for while loops', () => {
      const code = `
int main() {
    int i = 0;
    while (i < 5) {
        i = i + 1;
    }
    return i;
}
`;
      const ir = generateIR(code);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('while.cond');
      expect(irString).toContain('while.body');
      expect(irString).toContain('while.after');
      expect(irString).toContain('jump');
    });

    it('should generate IR for for loops', () => {
      const code = `
int main() {
    int sum = 0;
    for (int i = 0; i < 5; i = i + 1) {
        sum = sum + i;
    }
    return sum;
}
`;
      const ir = generateIR(code);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('for.cond');
      expect(irString).toContain('for.body');
      expect(irString).toContain('for.inc');
      expect(irString).toContain('for.after');
    });
  });

  describe('Global variables', () => {
    it('should generate IR for global variables', () => {
      const code = `
int global_var = 42;

int main() {
    return global_var;
}
`;
      const ir = generateIR(code);
      
      expect(ir.globals).toHaveLength(1);
      expect(ir.globals[0].name).toBe('global_var');
      expect(ir.globals[0].type).toBe('i32');
      expect(ir.globals[0].initializer?.value).toBe(42);
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('@global_var = global i32 42');
    });
  });

  describe('Complex programs', () => {
    it('should generate IR for factorial function', () => {
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
      const ir = generateIR(code);
      
      expect(ir.functions).toHaveLength(2);
      
      const factorial = ir.functions.find(f => f.name === 'factorial')!;
      expect(factorial.parameters).toHaveLength(1);
      expect(factorial.body.length).toBeGreaterThan(1); // Should have multiple blocks
      
      const irString = prettyPrintIR(ir);
      expect(irString).toContain('le');
      expect(irString).toContain('sub');
      expect(irString).toContain('mul');
      expect(irString).toContain('call factorial');
    });

    it('should generate IR for multiple functions with different signatures', () => {
      const code = `
char get_char() {
    return 'a';
}

void do_nothing() {
    return;
}

int compute(int x, int y) {
    int sum = x + y;
    return sum;
}
`;
      const ir = generateIR(code);
      
      expect(ir.functions).toHaveLength(3);
      
      const getChar = ir.functions.find(f => f.name === 'get_char')!;
      expect(getChar.returnType).toBe('i8');
      expect(getChar.parameters).toHaveLength(0);
      
      const doNothing = ir.functions.find(f => f.name === 'do_nothing')!;
      expect(doNothing.returnType).toBe('void');
      expect(doNothing.parameters).toHaveLength(0);
      
      const compute = ir.functions.find(f => f.name === 'compute')!;
      expect(compute.returnType).toBe('i32');
      expect(compute.parameters).toHaveLength(2);
    });
  });
});