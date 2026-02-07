#!/usr/bin/env node

import { readFile } from 'fs';
import { Lexer } from './dist/lexer/Lexer';
import { Parser } from './dist/parser/Parser';
import { SemanticAnalyzer } from './dist/semantic/SemanticAnalyzer';
import { IRGenerator } from './dist/codegen/IRGenerator';
import { generateX8664Assembly } from './dist/codegen/AssemblyGenerator';
import { generateELFObjectFile } from './dist/codegen/ELFGenerator';
import { prettyPrintIR } from './dist/codegen/IR';

/**
 * C Compiler Frontend Demo
 * 
 * Usage: node compile.js <source-file>
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
    console.log('Usage: node compile.js <source-file>');
    console.log('Example: node compile.js examples/hello.c');
    process.exit(1);
  }
  
  const sourceFile = args[0];
  
  try {
    // Read source file
    const sourceCode = await readFile(sourceFile, 'utf-8');
    console.log(`=== Compiling ${sourceFile} ===`);
    console.log(`\n=== Source Code ===\n${sourceCode}`);
    
    // Phase 1: Lexical Analysis
    console.log(`\n=== Phase 1: Lexical Analysis ===`);
    const lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize();
    console.log(`Generated ${tokens.length} tokens`);
    
    // Phase 2: Parsing
    console.log(`\n=== Phase 2: Parsing ===`);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`Parsed AST with ${ast.declarations.length} top-level declarations`);
    
    // Phase 3: Semantic Analysis
    console.log(`\n=== Phase 3: Semantic Analysis ===`);
    const analyzer = new SemanticAnalyzer();
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
    const irGenerator = new IRGenerator();
    const ir = irGenerator.generate(ast);
    console.log(`Generated IR with ${ir.functions.length} functions`);
    console.log(`IR:\n${prettyPrintIR(ir)}`);
    
    // Phase 5: Assembly Generation
    console.log(`\n=== Phase 5: Assembly Generation ===`);
    const assembly = generateX8664Assembly(ir);
    console.log(`Generated x86-64 assembly:\n${assembly}`);
    
    // Phase 6: ELF Generation
    console.log(`\n=== Phase 6: ELF Object File Generation ===`);
    const assemblyProgram = {
      sections: parseAssemblySections(assembly),
      globals: [],
    };
    
    const elf = generateELFObjectFile(assemblyProgram);
    
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
    
  } catch (error) {
    console.error(`Compilation failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

function parseAssemblySections(assembly: string) {
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
}

async function writeFile(filename: string, data: Uint8Array) {
  const fs = await import('fs');
  return fs.promises.writeFile(filename, data);
}

// Run the compiler
if (require.main === module) {
  main().catch(console.error);
}