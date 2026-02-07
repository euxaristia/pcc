#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const Lexer_1 = require("./lexer/Lexer");
const Parser_1 = require("./parser/Parser");
const SemanticAnalyzer_1 = require("./semantic/SemanticAnalyzer");
const IRGenerator_1 = require("./codegen/IRGenerator");
const AssemblyGenerator_1 = require("./codegen/AssemblyGenerator");
const ELFGenerator_1 = require("./codegen/ELFGenerator");
const IR_1 = require("./codegen/IR");
/**
 * C Compiler Frontend Demo
 *
 * Usage: node dist/compile.js <source-file>
 *
 * This script demonstrates the complete C compilation pipeline:
 * 1. Lexical Analysis
 * 2. Parsing
 * 3. Semantic Analysis
 * 4. IR Generation
 * 5. Assembly Generation
 * 6. ELF Object File Generation
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.log('Usage: node dist/compile.js <source-file>');
        console.log('Example: node dist/compile.js examples/hello.c');
        process.exit(1);
    }
    const sourceFile = args[0];
    try {
        // Read source file
        const sourceCode = await (0, promises_1.readFile)(sourceFile, 'utf-8');
        console.log(`=== Compiling ${sourceFile} ===`);
        console.log(`\n=== Source Code ===\n${sourceCode}`);
        // Phase 1: Lexical Analysis
        console.log(`\n=== Phase 1: Lexical Analysis ===`);
        const lexer = new Lexer_1.Lexer(sourceCode);
        const tokens = lexer.tokenize();
        console.log(`Generated ${tokens.length} tokens`);
        // Phase 2: Parsing
        console.log(`\n=== Phase 2: Parsing ===`);
        const parser = new Parser_1.Parser(tokens);
        const ast = parser.parse();
        console.log(`Parsed AST with ${ast.declarations.length} top-level declarations`);
        // Phase 3: Semantic Analysis
        console.log(`\n=== Phase 3: Semantic Analysis ===`);
        const analyzer = new SemanticAnalyzer_1.SemanticAnalyzer();
        const semanticErrors = analyzer.analyze(ast);
        if (semanticErrors.length > 0) {
            console.log(`Semantic errors found:`);
            semanticErrors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error.message} (line ${error.line}, column ${error.column})`);
            });
            process.exit(1);
        }
        console.log(`Semantic analysis passed`);
        // Phase 4: IR Generation
        console.log(`\n=== Phase 4: IR Generation ===`);
        const irGenerator = new IRGenerator_1.IRGenerator();
        const ir = irGenerator.generate(ast);
        console.log(`Generated IR with ${ir.functions.length} functions`);
        console.log(`IR:\n${(0, IR_1.prettyPrintIR)(ir)}`);
        // Phase 5: Assembly Generation
        console.log(`\n=== Phase 5: Assembly Generation ===`);
        const assembly = (0, AssemblyGenerator_1.generateX8664Assembly)(ir);
        console.log(`Generated x86-64 assembly:\n${assembly}`);
        // Phase 6: ELF Generation
        console.log(`\n=== Phase 6: ELF Object File Generation ===`);
        const assemblyProgram = {
            sections: parseAssemblySections(assembly),
            globals: [],
        };
        const elf = (0, ELFGenerator_1.generateELFObjectFile)(assemblyProgram);
        // Write ELF file
        const elfFileName = sourceFile.replace(/\.c$/, '.o');
        await writeFile(elfFileName, elf);
        console.log(`Successfully compiled to ${elfFileName}`);
        console.log(`ELF file size: ${elf.length} bytes`);
        console.log(`\n=== ELF Header Info ===`);
        console.log(`Magic: ${Array.from(elf.slice(0, 4)).map(b => String.fromCharCode(b)).join('')}`);
        console.log(`Class: ${elf[4] === 2 ? '64-bit' : '32-bit'}`);
        console.log(`Endianness: ${elf[5] === 1 ? 'Little' : 'Big'}`);
        console.log(`Machine: ${elf[18] === 0x3E ? 'x86-64' : 'Unknown'}`);
        console.log(`Type: ${elf[16] === 1 ? 'Relocatable' : 'Unknown'}`);
        console.log(`\n=== Compilation Complete ===`);
        console.log(`The generated object file can be linked with:`);
        console.log(`  gcc ${elfFileName} -o output`);
    }
    catch (error) {
        console.error(`Compilation failed: ${error.message}`);
        process.exit(1);
    }
}
function parseAssemblySections(assembly) {
    const lines = assembly.split('\n');
    const sections = [];
    let currentSection = null;
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
        }
        else if (currentSection && trimmed !== '') {
            currentSection.content += line + '\n';
        }
    }
    if (currentSection) {
        sections.push(currentSection);
    }
    return sections;
}
async function writeFile(filename, data) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    return fs.promises.writeFile(filename, data);
}
// Run the compiler
if (require.main === module) {
    main().catch(console.error);
}
