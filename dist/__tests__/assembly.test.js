"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lexer_1 = require("../lexer/Lexer");
const Parser_1 = require("../parser/Parser");
const IRGenerator_1 = require("../codegen/IRGenerator");
const AssemblyGenerator_1 = require("../codegen/AssemblyGenerator");
describe('AssemblyGenerator', () => {
    const generateAssembly = (code) => {
        const lexer = new Lexer_1.Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser_1.Parser(tokens);
        const ast = parser.parse();
        const irGen = new IRGenerator_1.IRGenerator();
        const ir = irGen.generate(ast);
        return (0, AssemblyGenerator_1.generateX8664Assembly)(ir);
    };
    describe('Basic function assembly', () => {
        it('should generate assembly for a simple function', () => {
            const code = `
int main() {
    return 42;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('.text');
            expect(assembly).toContain('.globl main');
            expect(assembly).toContain('main:');
            expect(assembly).toContain('push rbp');
            expect(assembly).toContain('mov rsp, rbp');
            expect(assembly).toContain('mov $42, rax');
            expect(assembly).toContain('pop rbp');
            expect(assembly).toContain('ret');
        });
        it('should generate assembly for function with parameters', () => {
            const code = `
int add(int a, int b) {
    return a + b;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('.globl add');
            expect(assembly).toContain('add:');
            expect(assembly).toContain('rdi'); // First parameter register
            expect(assembly).toContain('rsi'); // Second parameter register
            expect(assembly).toContain('add'); // Addition operation
        });
    });
    describe('Variable handling', () => {
        it('should generate assembly for local variables', () => {
            const code = `
int main() {
    int x = 5;
    int y = 10;
    return x + y;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('sub rsp,'); // Stack allocation
            expect(assembly).toContain('[rbp -'); // Stack access
            expect(assembly).toContain('mov $5,');
            expect(assembly).toContain('mov $10,');
        });
        it('should generate assembly for global variables', () => {
            const code = `
int global_var = 42;

int main() {
    return global_var;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('.data');
            expect(assembly).toContain('.globl global_var');
            expect(assembly).toContain('global_var:');
            expect(assembly).toContain('.long 42');
            expect(assembly).toContain('global_var'); // Global access
        });
    });
    describe('Expressions', () => {
        it('should generate assembly for arithmetic expressions', () => {
            const code = `
int main() {
    int a = 2;
    int b = 3;
    int c = a + b * 4;
    return c;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('imul'); // Multiplication
            expect(assembly).toContain('add'); // Addition
        });
        it('should generate assembly for comparison expressions', () => {
            const code = `
int main() {
    int a = 5;
    int b = 3;
    int c = a > b;
    return c;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('cmp');
            expect(assembly).toContain('setg'); // Greater than
        });
        it('should generate assembly for function calls', () => {
            const code = `
int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(5, 3);
    return result;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('call add');
            expect(assembly).toContain('mov $5, rdi'); // First argument
            expect(assembly).toContain('mov $3, rsi'); // Second argument
            expect(assembly).toContain('push rax'); // Save caller-save registers
            expect(assembly).toContain('pop rax'); // Restore caller-save registers
        });
    });
    describe('Control flow', () => {
        it('should generate assembly for if statements', () => {
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
            const assembly = generateAssembly(code);
            expect(assembly).toContain('cmp');
            expect(assembly).toContain('jne');
            expect(assembly).toContain('jmp');
            expect(assembly).toContain('then_');
            expect(assembly).toContain('else_');
            expect(assembly).toContain('merge_');
        });
        it('should generate assembly for while loops', () => {
            const code = `
int main() {
    int i = 0;
    while (i < 5) {
        i = i + 1;
    }
    return i;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('while.cond');
            expect(assembly).toContain('while.body');
            expect(assembly).toContain('while.after');
            expect(assembly).toContain('setl'); // Less than set (or jl)
        });
        it('should generate assembly for for loops', () => {
            const code = `
int main() {
    int sum = 0;
    for (int i = 0; i < 5; i = i + 1) {
        sum = sum + i;
    }
    return sum;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('for.cond');
            expect(assembly).toContain('for.body');
            expect(assembly).toContain('for.inc');
            expect(assembly).toContain('for.after');
        });
    });
    describe('Data types', () => {
        it('should handle character types', () => {
            const code = `
int main() {
    char c = 'a';
    return c;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('$97'); // ASCII value of 'a'
        });
        it('should handle void functions', () => {
            const code = `
void do_nothing() {
    return;
}

int main() {
    do_nothing();
    return 0;
}
`;
            const assembly = generateAssembly(code);
            expect(assembly).toContain('.globl do_nothing');
            expect(assembly).toContain('call do_nothing');
            expect(assembly).toContain('ret'); // Return instruction
        });
    });
    describe('Complex programs', () => {
        it('should generate assembly for factorial function', () => {
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
            const assembly = generateAssembly(code);
            expect(assembly).toContain('factorial:');
            expect(assembly).toContain('call factorial');
            expect(assembly).toContain('imul');
            expect(assembly).toContain('sub'); // For n - 1
        });
    });
});
