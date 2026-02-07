"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lexer_1 = require("../lexer/Lexer");
const Parser_1 = require("../parser/Parser");
const IRGenerator_1 = require("../codegen/IRGenerator");
const AssemblyGenerator_1 = require("../codegen/AssemblyGenerator");
const ELFGenerator_1 = require("../codegen/ELFGenerator");
describe('ELFGenerator', () => {
    const generateELF = (code) => {
        const lexer = new Lexer_1.Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser_1.Parser(tokens);
        const ast = parser.parse();
        const irGen = new IRGenerator_1.IRGenerator();
        const ir = irGen.generate(ast);
        const assembly = (0, AssemblyGenerator_1.generateX8664Assembly)(ir);
        const assemblyProgram = {
            sections: [],
            globals: [],
        };
        // Parse the assembly to extract sections
        const lines = assembly.split('\n');
        let currentSection = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('.') && !trimmed.startsWith('.globl') && !trimmed.startsWith('.long') && !trimmed.startsWith('.byte') && !trimmed.startsWith('.quad')) {
                // New section
                if (currentSection) {
                    assemblyProgram.sections.push(currentSection);
                }
                currentSection = {
                    name: trimmed,
                    content: '',
                };
            }
            else if (currentSection && trimmed !== '') {
                currentSection.content += line + '\n';
            }
        }
        if (currentSection) {
            assemblyProgram.sections.push(currentSection);
        }
        return (0, ELFGenerator_1.generateELFObjectFile)(assemblyProgram);
    };
    describe('ELF header generation', () => {
        it('should generate a valid ELF header', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf = generateELF(code);
            // Check ELF magic number
            expect(elf[0]).toBe(0x7F);
            expect(elf[1]).toBe(0x45); // 'E'
            expect(elf[2]).toBe(0x4C); // 'L'
            expect(elf[3]).toBe(0x46); // 'F'
            // Check 64-bit
            expect(elf[4]).toBe(2); // EI_CLASS = 2 for 64-bit
            // Check little endian
            expect(elf[5]).toBe(1); // EI_DATA = 1 for little endian
            // Check x86-64 machine type
            // Machine type is at offset 0x12 (18), little endian 0x3E
            expect(elf[18]).toBe(0x3E);
            expect(elf[19]).toBe(0x00);
            // Check relocatable type (1)
            expect(elf[16]).toBe(0x01);
            expect(elf[17]).toBe(0x00);
        });
        it('should have correct section header offset', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf = generateELF(code);
            // Section header offset should be after ELF header and section data
            // The actual value depends on section sizes
            const shoff = elf[40] | (elf[41] << 8) | (elf[42] << 16) | (elf[43] << 24);
            expect(shoff).toBeGreaterThan(64);
        });
    });
    describe('Section generation', () => {
        it('should generate text section', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf = generateELF(code);
            // Should contain text section data
            let hasTextSection = false;
            let foundInstructions = false;
            // Check for basic x86-64 instructions in the file
            for (let i = 0; i < elf.length - 10; i++) {
                // Look for push rbp (0x55)
                if (elf[i] === 0x55) {
                    foundInstructions = true;
                }
                // Look for mov rax, imm32 (0x48, 0xC7, 0xC0)
                if (elf[i] === 0x48 && elf[i + 1] === 0xC7 && elf[i + 2] === 0xC0) {
                    foundInstructions = true;
                }
                // Look for ret (0xC3)
                if (elf[i] === 0xC3) {
                    foundInstructions = true;
                }
            }
            expect(foundInstructions).toBe(true);
        });
        it('should generate data section for global variables', () => {
            const code = `
int global_var = 12345;

int main() {
    return global_var;
}
`;
            const elf = generateELF(code);
            // Should contain the value 12345 (0x3039) in little endian
            let foundValue = false;
            for (let i = 0; i < elf.length - 4; i++) {
                // Check for 12345 in little endian: 0x39, 0x30, 0x00, 0x00
                if (elf[i] === 0x39 && elf[i + 1] === 0x30 &&
                    elf[i + 2] === 0x00 && elf[i + 3] === 0x00) {
                    foundValue = true;
                    break;
                }
            }
            expect(foundValue).toBe(true);
        });
    });
    describe('Section headers', () => {
        it('should have correct number of section headers', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf = generateELF(code);
            // Section header count is at offset 0x3C (60)
            const shnum = elf[60] | (elf[61] << 8);
            // Should have at least: null, .text sections
            expect(shnum).toBeGreaterThanOrEqual(2);
        });
        it('should have string table section', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf = generateELF(code);
            // String table index is at offset 0x3E (62)
            const shstrndx = elf[62] | (elf[63] << 8);
            // Should point to the last section (string table)
            expect(shstrndx).toBeGreaterThan(0);
        });
    });
    describe('Complete programs', () => {
        it('should generate ELF for simple arithmetic program', () => {
            const code = `
int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(5, 3);
    return result;
}
`;
            const elf = generateELF(code);
            // Should be a valid ELF file
            expect(elf.length).toBeGreaterThan(100); // Should be substantial
            // Should have ELF magic
            expect(elf[0]).toBe(0x7F);
            expect(elf[1]).toBe(0x45);
            expect(elf[2]).toBe(0x4C);
            expect(elf[3]).toBe(0x46);
            // Should have at least basic sections
            const shnum = elf[60] | (elf[61] << 8);
            expect(shnum).toBeGreaterThanOrEqual(2);
        });
        it('should generate ELF for program with control flow', () => {
            const code = `
int main() {
    int i = 0;
    if (i < 5) {
        return 1;
    } else {
        return 0;
    }
}
`;
            const elf = generateELF(code);
            // Should be a valid ELF file with conditional logic
            expect(elf.length).toBeGreaterThan(100);
            // Should have ELF magic
            expect(elf[0]).toBe(0x7F);
            expect(elf[1]).toBe(0x45);
            expect(elf[2]).toBe(0x4C);
            expect(elf[3]).toBe(0x46);
        });
    });
    describe('File format validation', () => {
        it('should generate consistent ELF files', () => {
            const code = `
int main() {
    return 42;
}
`;
            const elf1 = generateELF(code);
            const elf2 = generateELF(code);
            // Same program should generate identical ELF files
            expect(elf1.length).toBe(elf2.length);
            for (let i = 0; i < elf1.length; i++) {
                expect(elf1[i]).toBe(elf2[i]);
            }
        });
        it('should generate different ELF files for different programs', () => {
            const code1 = `
int main() {
    return 1;
}
`;
            const code2 = `
int global_var = 42;
int main() {
    return global_var;
}
`;
            const elf1 = generateELF(code1);
            const elf2 = generateELF(code2);
            // Different return values should generate different ELF files
            let hasDifference = false;
            for (let i = 0; i < Math.min(elf1.length, elf2.length); i++) {
                if (elf1[i] !== elf2[i]) {
                    hasDifference = true;
                    break;
                }
            }
            expect(hasDifference).toBe(true);
        });
    });
});
