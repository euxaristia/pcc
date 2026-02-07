#!/usr/bin/env node

import { Lexer } from './lexer/Lexer';
import { Parser } from './parser/Parser';
import { SemanticAnalyzer } from './semantic/SemanticAnalyzer';
import { IRGenerator } from './codegen/IRGenerator';
import { generateX8664Assembly } from './codegen/AssemblyGenerator';
import { generateELFObjectFile } from './codegen/ELFGenerator';

import { readFile } from 'fs/promises';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node dist/demo.js <source-file>');
    console.log('Example: node dist/demo.js simple-kernel.c');
    process.exit(1);
  }
  
  const filePath = args[0];
  const code = await readFile(filePath, 'utf-8');
  
  console.log('=== C Compiler Pipeline Demo ===');
  console.log(`\n=== Source File: ${filePath} ===`);
  console.log(`\n=== Source Code ===\n${code}`);

  console.log('=== C Compiler Pipeline Demo ===');
  
  // Phase 1: Lexical Analysis
  console.log('\n1. Lexical Analysis');
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log(`   Generated ${tokens.length} tokens`);
  
  // Phase 2: Parsing
  console.log('\n2. Parsing');
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`   Parsed AST with ${ast.declarations.length} declarations`);
  
  // Phase 3: Semantic Analysis
  console.log('\n3. Semantic Analysis');
  const analyzer = new SemanticAnalyzer();
  const errors = analyzer.analyze(ast);
  
  if (errors.length > 0) {
    console.log('   Semantic errors:');
    errors.forEach(e => console.log(`   - ${e.message}`));
    return;
  }
  console.log('   Semantic analysis passed');
  
  // Phase 4: IR Generation
  console.log('\n4. IR Generation');
  const irGenerator = new IRGenerator();
  const ir = irGenerator.generate(ast);
  console.log(`   Generated IR with ${ir.functions.length} functions`);
  
  // Phase 5: Assembly Generation
  console.log('\n5. Assembly Generation');
  const assembly = generateX8664Assembly(ir);
  console.log('   Generated x86-64 assembly (first 200 chars):');
  console.log(`   ${assembly.substring(0, 200)}...`);
  
  // Phase 6: ELF Generation
  console.log('\n6. ELF Object File Generation');
  const assemblyProgram = {
    sections: [],
    globals: [],
  };
  
  // Simple section parsing
  const lines = assembly.split('\n');
  let currentSection: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('.text') || trimmed.startsWith('.data')) {
      if (currentSection) {
        assemblyProgram.sections.push(currentSection);
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
    assemblyProgram.sections.push(currentSection);
  }
  
  const elf = generateELFObjectFile(assemblyProgram);
  console.log(`   Generated ELF object file: ${elf.length} bytes`);
  
  // ELF header info
  console.log('\n=== ELF Header ===');
  console.log(`   Magic: ${Array.from(elf.slice(0, 4)).map(b => String.fromCharCode(b)).join('')}`);
  console.log(`   Class: ${elf[4] === 2 ? '64-bit' : '32-bit'}`);
  console.log(`   Endianness: ${elf[5] === 1 ? 'Little' : 'Big'}`);
  console.log(`   Machine: ${(elf[18] === 0x3E) ? 'x86-64' : 'Unknown'}`);
  console.log(`   Type: ${elf[16] === 1 ? 'Relocatable' : 'Unknown'}`);
  
  // Write ELF file
  const fs = await import('fs');
  await fs.promises.writeFile('output.o', elf);
  console.log('\n=== Success! ===');
  console.log('Generated: output.o');
  console.log('Link with: gcc output.o -o program');
}

main().catch(console.error);