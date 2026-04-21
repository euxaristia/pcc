#!/usr/bin/env node

import { readFile, writeFile as fsWriteFile } from 'fs/promises';
import { Lexer } from './lexer/Lexer';
import { Parser } from './parser/Parser';
import { SemanticAnalyzer } from './semantic/SemanticAnalyzer';
import { IRGenerator } from './codegen/IRGenerator';
import { generateX8664Assembly } from './codegen/AssemblyGenerator';
import { generateARM64Assembly } from './codegen/ARM64AssemblyGenerator';
import { generateELFObjectFile } from './codegen/ELFGenerator';
import { prettyPrintIR } from './codegen/IR';
import { Preprocessor, PreprocessorOptions } from './preprocessor/Preprocessor';
import { getCallingConvention } from './codegen/TargetArchitecture';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';

interface CompilerOptions {
  sourceFiles: string[];
  outputFile?: string;
  compileOnly: boolean;
  preprocessOnly: boolean;
  emitAssembly: boolean;
  includePaths: string[];
  defines: Record<string, string>;
  verbose: boolean;
  tokenDebug: boolean;
  arch: string;
  debugInfo: boolean;
  optimizeLevel: number;
  warnings: string[];
  werror: boolean;
  std: string;
  depsMode: boolean;
  depsFile?: string;
  phonyTargets: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(rawArgs: string[]): CompilerOptions {
  const options: CompilerOptions = {
    sourceFiles: [],
    compileOnly: false,
    preprocessOnly: false,
    emitAssembly: false,
    includePaths: [],
    defines: {},
    verbose: process.env.PCC_VERBOSE === '1',
    tokenDebug: process.env.PCC_TOKENS === '1',
    arch: 'x86-64',
    debugInfo: false,
    optimizeLevel: 0,
    warnings: [],
    werror: false,
    std: 'c99',
    depsMode: false,
    phonyTargets: false,
    help: false,
    version: false,
  };

  let i = 0;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      i++;
    } else if (arg === '-v' || arg === '-V' || arg === '--version') {
      options.version = true;
      i++;
    } else if (arg === '--verbose') {
      options.verbose = true;
      i++;
    } else if (arg === '--tokens') {
      options.tokenDebug = true;
      i++;
    } else if (arg === '-c') {
      options.compileOnly = true;
      i++;
    } else if (arg === '-S') {
      options.emitAssembly = true;
      i++;
    } else if (arg === '-E') {
      options.preprocessOnly = true;
      i++;
    } else if (arg === '-o') {
      if (i + 1 >= rawArgs.length) {
        console.error('Error: -o requires an argument');
        process.exit(1);
      }
      options.outputFile = rawArgs[i + 1];
      i += 2;
    } else if (arg.startsWith('--arch=')) {
      options.arch = arg.split('=')[1] || 'x86-64';
      i++;
    } else if (arg === '-g') {
      options.debugInfo = true;
      i++;
    } else if (arg.startsWith('-O')) {
      const level = arg.slice(2);
      if (level === '0' || level === '1' || level === '2' || level === '3' || level === 's' || level === 'z' || level === 'fast') {
        if (level === 's' || level === 'z' || level === 'fast') {
          options.optimizeLevel = 2;
        } else {
          options.optimizeLevel = parseInt(level, 10);
        }
      } else {
        options.optimizeLevel = 1;
      }
      i++;
    } else if (arg.startsWith('-std=')) {
      options.std = arg.slice(5);
      i++;
    } else if (arg === '-Wall') {
      options.warnings.push('all');
      i++;
    } else if (arg === '-Werror') {
      options.werror = true;
      i++;
    } else if (arg.startsWith('-W')) {
      const warn = arg.slice(2);
      if (warn && warn !== 'error') {
        options.warnings.push(warn);
      }
      i++;
    } else if (arg === '-MMD') {
      options.depsMode = true;
      i++;
    } else if (arg === '-MF') {
      if (i + 1 >= rawArgs.length) {
        console.error('Error: -MF requires an argument');
        process.exit(1);
      }
      options.depsFile = rawArgs[i + 1];
      i += 2;
    } else if (arg === '-MP') {
      options.phonyTargets = true;
      i++;
    } else if (arg.startsWith('-I')) {
      const path = arg.slice(2) || (i + 1 < rawArgs.length ? rawArgs[++i] : undefined);
      if (path) {
        options.includePaths.push(path);
      }
      i++;
    } else if (arg.startsWith('-D')) {
      const def = arg.slice(2) || (i + 1 < rawArgs.length ? rawArgs[++i] : undefined);
      if (def) {
        const eqIdx = def.indexOf('=');
        if (eqIdx >= 0) {
          options.defines[def.slice(0, eqIdx)] = def.slice(eqIdx + 1);
        } else {
          options.defines[def] = '1';
        }
      }
      i++;
    } else if (arg.startsWith('-')) {
      console.error(`Error: unrecognized option '${arg}'`);
      process.exit(1);
    } else if (arg.endsWith('.c')) {
      options.sourceFiles.push(arg);
      i++;
    } else {
      console.error(`Warning: unrecognized argument '${arg}'`);
      i++;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: pcc [options] <source-file.c>

Options:
  -o <file>           Write output to <file>
  -c                  Compile only, do not link
  -S                  Compile to assembly only
  -E                  Preprocess only
  -I <path>           Add include search path
  -D <name>[=value]   Define preprocessor macro
  -g                  Generate debug information
  -O0, -O1, -O2, -O3  Set optimization level
  -Os, -Oz            Optimize for size
  -Wall               Enable all warnings
  -Werror             Treat warnings as errors
  -std=<standard>     Set language standard (c99, c11, gnu99, gnu11)
  -MMD                Generate dependency information
  -MF <file>          Set dependency output file
  -MP                 Add phony targets for headers
  --arch=<arch>       Target architecture (x86-64, arm64)
  --verbose           Enable verbose output
  --tokens            Print tokens during lexing
  -h, --help          Show this help message
  -v, --version       Show version information
`);
}

function printVersion(arch: string) {
  console.log(`
 ____   ____ ____
|  _ \\ / ___/ ___|
| |_) | |  | |
|  __/| |__| |___
|_|    \\____\\____|

   Pickle C Compiler (pcc) v1.1.0-${process.env.PCC_COMMIT || 'dev'}
   A modern TypeScript-based C compiler for ${arch}
  `);
}

function logPhase(phase: string, options: CompilerOptions) {
  if (options.verbose) {
    console.log(`\n=== ${phase} ===`);
  }
}

function logInfo(message: string, options: CompilerOptions) {
  if (options.verbose) {
    console.log(message);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const options = parseArgs(rawArgs);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion(options.arch);
    process.exit(0);
  }

  if (options.sourceFiles.length === 0) {
    console.error('Error: no input files');
    printHelp();
    process.exit(1);
  }

  if (options.sourceFiles.length > 1 && options.outputFile) {
    console.error('Error: cannot specify -o with multiple source files');
    process.exit(1);
  }

  if (options.debugInfo) {
    logInfo('Note: debug information generation is not yet fully implemented', options);
  }

  if (options.optimizeLevel > 0) {
    logInfo(`Note: optimization level -O${options.optimizeLevel} not yet implemented`, options);
  }

  for (const sourceFile of options.sourceFiles) {
    try {
      await compileFile(sourceFile, options);
    } catch (error) {
      console.error(`Compilation failed for ${sourceFile}: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}

function runCPreprocessor(source: string, sourceFile: string, options: CompilerOptions): string {
  const cppPath = `${process.cwd()}/src-c/preprocessor/cpp`;
  if (!existsSync(cppPath)) {
    throw new Error('C preprocessor not built. Run: cd src-c/preprocessor && make cpp');
  }

  const args: string[] = [];
  for (const path of options.includePaths) {
    args.push('-I', path);
  }
  for (const def of Object.entries(options.defines)) {
    const val = def[1] === '1' ? def[0] : `${def[0]}=${def[1]}`;
    args.push('-D', val);
  }
  args.push(sourceFile);

  const result = execFileSync(cppPath, args, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

async function compileFile(sourceFile: string, options: CompilerOptions) {
  // Read source file
  const sourceCode = await readFile(sourceFile, 'utf-8');
  if (options.verbose) {
    console.log(`\n=== Compiling ${sourceFile} ===`);
    console.log(`\n=== Source Code ===\n${sourceCode}`);
  }

  // Determine output path
  let outputPath: string;
  if (options.outputFile && options.sourceFiles.length === 1) {
    outputPath = options.outputFile;
  } else if (options.preprocessOnly) {
    outputPath = sourceFile.replace(/\.c$/, '.i');
  } else if (options.emitAssembly) {
    outputPath = sourceFile.replace(/\.c$/, '.s');
  } else {
    outputPath = sourceFile.replace(/\.c$/, '.o');
  }

  // Note: multiple source files with -o is rejected in main() before reaching here

  // Phase 0: Preprocessing
  logPhase('Phase 0: Preprocessing', options);

  let preprocessedCode: string;
  const useCPreprocessor = process.env.PCC_CPP === '1';
  if (useCPreprocessor) {
    try {
      preprocessedCode = runCPreprocessor(sourceCode, sourceFile, options);
      logInfo('Used C preprocessor', options);
    } catch (err) {
      logInfo('C preprocessor failed, falling back to TypeScript: ' + (err as Error).message, options);
      const preprocessorOpts: PreprocessorOptions = {
        includePaths: options.includePaths,
        defines: options.defines,
      };
      const preprocessor = new Preprocessor(preprocessorOpts);
      preprocessedCode = preprocessor.preprocess(sourceCode, sourceFile);
    }
  } else {
    const preprocessorOpts: PreprocessorOptions = {
      includePaths: options.includePaths,
      defines: options.defines,
    };
    const preprocessor = new Preprocessor(preprocessorOpts);
    preprocessedCode = preprocessor.preprocess(sourceCode, sourceFile);
  }

  logInfo(`Preprocessed ${preprocessedCode.split('\n').length} lines`, options);
  if (options.verbose) console.log(`\n=== Preprocessed Code ===\n${preprocessedCode}`);

  if (options.preprocessOnly) {
    if (options.outputFile === '-') {
      process.stdout.write(preprocessedCode + '\n');
    } else {
      await fsWriteFile(outputPath, preprocessedCode);
      if (options.verbose) console.log(`Preprocessed output written to ${outputPath}`);
    }
    return;
  }

  // Phase 1: Lexical Analysis
  logPhase('Phase 1: Lexical Analysis', options);
  const lexer = new Lexer(preprocessedCode);
  const tokens = lexer.tokenize();
  logInfo(`Generated ${tokens.length} tokens`, options);
  if (options.tokenDebug) {
    tokens.forEach((token, i) => {
      console.log(`  [${i}] ${token.type}: '${token.value}' at ${token.line}:${token.column}`);
    });
  }

  // Phase 2: Parsing
  logPhase('Phase 2: Parsing', options);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  logInfo(`Parsed AST with ${ast.declarations.length} top-level declarations`, options);

  // Phase 3: Semantic Analysis
  logPhase('Phase 3: Semantic Analysis', options);
  const analyzer = new SemanticAnalyzer();
  const semanticErrors = analyzer.analyze(ast);

  if (semanticErrors.length > 0) {
    const label = options.werror ? 'Semantic errors' : 'Semantic warnings';
    console.log(`${label} found:`);
    semanticErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message} (line ${error.line}, column ${error.column})`);
    });
    if (options.werror) {
      throw new Error('Compilation aborted due to warnings treated as errors');
    }
  } else {
    logInfo('Semantic analysis passed', options);
  }

  // Phase 4: IR Generation
  logPhase('Phase 4: IR Generation', options);
  const irGenerator = new IRGenerator();
  const ir = irGenerator.generate(ast);
  logInfo(`Generated IR with ${ir.functions.length} functions`, options);
  if (options.verbose) console.log(`IR:\n${prettyPrintIR(ir)}`);

  // Phase 5: Assembly Generation
  logPhase('Phase 5: Assembly Generation', options);
  let assembly: string;
  if (options.arch === 'arm64' || options.arch === 'aarch64') {
    assembly = generateARM64Assembly(ir);
    logInfo('Generated ARM64 assembly', options);
  } else {
    assembly = generateX8664Assembly(ir);
    logInfo('Generated x86-64 assembly', options);
  }
  if (options.verbose) console.log(`Assembly:\n${assembly}`);

  if (options.emitAssembly) {
    await fsWriteFile(outputPath, assembly);
    if (options.verbose) console.log(`Assembly written to ${outputPath}`);
    return;
  }

  // Phase 6: ELF Generation
  logPhase('Phase 6: ELF Object File Generation', options);
  const assemblyProgram = {
    sections: parseAssemblySections(assembly),
    globals: [],
  };

  const elf = generateELFObjectFile(assemblyProgram, options.arch);

  // Write ELF file
  await fsWriteFile(outputPath, elf);

  if (options.verbose) {
    console.log(`Successfully compiled to ${outputPath}`);
    console.log(`ELF file size: ${elf.length} bytes`);
    console.log(`\n=== ELF Header Info ===`);
    console.log(`Magic: ${Array.from(elf.slice(0, 4)).map(b => String.fromCharCode(b)).join('')}`);
    console.log(`Class: ${elf[4] === 2 ? '64-bit' : '32-bit'}`);
    console.log(`Endianness: ${elf[5] === 1 ? 'Little' : 'Big'}`);
    console.log(`Machine: ${getMachineName(options.arch)}`);
    console.log(`Type: ${elf[16] === 1 ? 'Relocatable' : 'Unknown'}`);
    console.log(`\n=== Compilation Complete ===`);
    console.log(`The generated object file can be linked with:`);
    console.log(`  gcc ${outputPath} -o output`);
  }
}

function getMachineName(arch: string): string {
  switch (arch) {
    case 'arm64':
    case 'aarch64':
      return 'ARM64';
    case 'i386':
    case 'i486':
    case 'i586':
    case 'i686':
      return 'i386';
    case 'x86-64':
    case 'x86_64':
    default:
      return 'x86-64';
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

// Run the compiler
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
