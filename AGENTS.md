# AGENTS.md - pcc Developer Guide

## Critical: Always Use Bun

**This project ALWAYS uses `bun`, never `npm`, `npx`, or `ts-node`.**

- Build: `bun run build` (not `npm run build`)
- Test: `bun test` (not `npm test`)
- Run: `bun run src/compile.ts` (not `node dist/compile.js`)
- Dev: `bun run dev`

## Project Overview

pcc is a TypeScript-based C compiler targeting x86-64 Linux. It produces valid ELF object files.

## Compilation Pipeline

1. **Preprocessing** - Handles #define, #include, #ifdef, etc.
2. **Lexical Analysis** - Tokenizes C source code
3. **Parsing** - Builds Abstract Syntax Tree (AST)
4. **Semantic Analysis** - Type checking and symbol table management
5. **IR Generation** - Converts AST to SSA Intermediate Representation
6. **Assembly Generation** - Produces x86-64 assembly
7. **ELF Generation** - Creates relocatable object files

## Key Files

- `src/compile.ts` - Main compiler entry point
- `src/preprocessor/Preprocessor.ts` - C preprocessor implementation
- `src/lexer/Lexer.ts` - Tokenizer
- `src/parser/Parser.ts` - Parser
- `src/semantic/SemanticAnalyzer.ts` - Type checker
- `src/codegen/IRGenerator.ts` - IR generation
- `src/codegen/AssemblyGenerator.ts` - x86-64 assembly
- `src/codegen/ELFGenerator.ts` - ELF object files

## Testing

Run tests with: `bun test`

## Version Control

**After each tested working change, commit and push immediately:**

```bash
git add -A
git commit -m "Description of changes"
git push
```

This ensures changes are saved and can be reviewed incrementally.

## Environment Variables

- `PCC_VERBOSE=1` - Enable verbose output
- `PCC_TOKENS=1` - Print tokens during lexing
