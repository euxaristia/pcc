import { Lexer } from '../lexer/Lexer';
import { Parser } from '../parser/Parser';
import { SemanticAnalyzer } from '../semantic/SemanticAnalyzer';
import { IRGenerator } from '../codegen/IRGenerator';
import { generateX8664Assembly } from '../codegen/AssemblyGenerator';
import { generateELFObjectFile } from '../codegen/ELFGenerator';
import { prettyPrintIR } from '../codegen/IR';

describe('Complete Compilation Pipeline', () => {
  const compile = (code: string) => {
    try {
      // Phase 1: Lexical Analysis
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      
      // Phase 2: Parsing
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      // Phase 3: Semantic Analysis
      const analyzer = new SemanticAnalyzer();
      const errors = analyzer.analyze(ast);
      
      if (errors.length > 0) {
        return { 
          success: false, 
          errors,
          tokens, 
          ast, 
          ir: null, 
          assembly: '', 
          elf: null 
        };
      }
      
      // Phase 4: IR Generation
      const irGenerator = new IRGenerator();
      const ir = irGenerator.generate(ast);
      
      // Phase 5: Assembly Generation
      const assembly = generateX8664Assembly(ir);
      
      // Phase 6: ELF Generation
      const assemblyProgram = {
        sections: parseAssemblySections(assembly),
        globals: [],
      };
      
      const elf = generateELFObjectFile(assemblyProgram);
      
      return { 
        success: true, 
        errors: [], 
        tokens, 
        ast, 
        ir, 
        assembly, 
        elf 
      };
    } catch (error) {
      return {
        success: false,
        errors: [{ message: (error as Error).message }],
        tokens: null,
        ast: null,
        ir: null,
        assembly: '',
        elf: null
      };
    }
  };

  const parseAssemblySections = (assembly: string) => {
    const lines = assembly.split('\n');
    const sections: any[] = [];
    let currentSection: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('.') && !trimmed.startsWith('.globl') && 
          !trimmed.startsWith('.long') && !trimmed.startsWith('.byte') && 
          !trimmed.startsWith('.quad')) {
        // New section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: trimmed,
          content: '',
        };
      } else if (currentSection && trimmed !== '') {
        currentSection.content += line + '\n';
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  describe('End-to-end compilation', () => {
    it('should compile a simple program successfully', () => {
      const code = `
int main() {
    return 42;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.ast).toBeDefined();
      expect(result.ir).toBeDefined();
      expect(result.assembly).toContain('.text');
      expect(result.assembly).toContain('main:');
      expect(result.elf).toBeDefined();
      expect(result.elf.length).toBeGreaterThan(100);
      
      // Check ELF header
      expect(result.elf[0]).toBe(0x7F); // ELF magic
      expect(result.elf[1]).toBe(0x45); // 'E'
      expect(result.elf[2]).toBe(0x4C); // 'L'
      expect(result.elf[3]).toBe(0x46); // 'F'
    });

    it('should detect semantic errors', () => {
      const code = `
int main() {
    int x = undeclared_var;
    return 42;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Undeclared identifier');
    });

    it('should compile programs with functions', () => {
      const code = `
int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(5, 3);
    return result;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have multiple functions
      expect(result.ir.functions).toHaveLength(2);
      expect(result.assembly).toContain('add:');
      expect(result.assembly).toContain('main:');
      expect(result.assembly).toContain('call add');
    });

    it('should compile programs with control flow', () => {
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
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have conditional jumps
      expect(result.assembly).toContain('cmp');
      expect(result.assembly).toContain('jne');
      expect(result.assembly).toContain('jmp');
      
      // Should have multiple basic blocks
      const mainFunc = result.ir.functions.find(f => f.name === 'main');
      expect(mainFunc.body.length).toBeGreaterThan(1);
    });

    it('should compile programs with loops', () => {
      const code = `
int main() {
    int sum = 0;
    for (int i = 0; i < 5; i = i + 1) {
        sum = sum + i;
    }
    return sum;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have loop structure
      expect(result.assembly).toContain('for.cond');
      expect(result.assembly).toContain('for.body');
      expect(result.assembly).toContain('for.inc');
      expect(result.assembly).toContain('for.after');
    });

    it('should compile programs with global variables', () => {
      const code = `
int global_var = 12345;

int main() {
    return global_var;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have data section
      expect(result.assembly).toContain('.data');
      expect(result.assembly).toContain('global_var:');
      expect(result.assembly).toContain('.long 12345');
      
      // Should have global reference
      expect(result.assembly).toContain('global_var');
    });

    it('should compile recursive functions', () => {
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
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have recursive call
      expect(result.assembly).toContain('call factorial');
      expect(result.assembly).toContain('imul');
      expect(result.assembly).toContain('sub');
      
      // Should have proper control flow
      const factorial = result.ir.functions.find(f => f.name === 'factorial');
      expect(factorial.body.length).toBeGreaterThan(2);
    });
  });

  describe('Generated code quality', () => {
    it('should generate valid ELF files', () => {
      const code = `
int main() {
    return 42;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      
      const elf = result.elf!;
      
      // ELF header validation
      expect(elf[0]).toBe(0x7F);
      expect(elf[1]).toBe(0x45);
      expect(elf[2]).toBe(0x4C);
      expect(elf[3]).toBe(0x46);
      expect(elf[4]).toBe(2);  // 64-bit
      expect(elf[5]).toBe(1);  // little endian
      expect(elf[18]).toBe(0x3E); // x86-64
      
      // Should have sections
      const shnum = elf[60] | (elf[61] << 8);
      expect(shnum).toBeGreaterThanOrEqual(2);
    });

    it('should generate assembly with proper function prologues/epilogues', () => {
      const code = `
int main() {
    return 42;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('push rbp');
      expect(result.assembly).toContain('mov rsp, rbp');
      expect(result.assembly).toContain('pop rbp');
      expect(result.assembly).toContain('ret');
    });

    it('should generate IR with correct structure', () => {
      const code = `
int add(int a, int b) {
    return a + b;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(true);
      
      const ir = result.ir!;
      expect(ir.functions).toHaveLength(1);
      
      const func = ir.functions[0];
      expect(func.name).toBe('add');
      expect(func.returnType).toBe('i32');
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0].name).toBe('a');
      expect(func.parameters[1].name).toBe('b');
      expect(func.parameters[0].type).toBe('i32');
      expect(func.parameters[1].type).toBe('i32');
    });
  });

  describe('Error handling', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
int main() {
    return 42
} // Missing semicolon
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(false);
      // The parser should throw an error
    });

    it('should handle type errors', () => {
      const code = `
int main() {
    int x = 5;
    x = 'a';  // Type mismatch in assignment
    return x;
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have some kind of error for the invalid assignment
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined symbols', () => {
      const code = `
int main() {
    return undefined_function();
}
`;
      
      const result = compile(code);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('not declared');
    });
  });
});