Plan: Add Critical C Features for Alpine Kernel Compilation                                            │
│                                                                                                        │
│ Context                                                                                                │
│                                                                                                        │
│ pcc is a TypeScript-based C compiler targeting x86-64. It can currently compile simple C programs with │
│  basic types, control flow, and functions. To compile the Alpine Linux kernel (linux-6.18), it needs   │
│ many missing C language features. The kernel source must be preprocessed externally with gcc -E first  │
│ (pcc skips all # directives). After preprocessing, pcc must parse and compile the resulting C code,    │
│ which uses virtually every C language feature.                                                         │
│                                                                                                        │
│ This plan focuses on the highest-impact missing features that will unblock the most kernel code.       │
│                                                                                                        │
│ Strategy                                                                                               │
│                                                                                                        │
│ Use gcc -E for preprocessing. Focus on adding the C language features that appear most frequently in   │
│ preprocessed kernel code. Defer the ELF generator fixes for now (we can use gcc -S approach or fix     │
│ later) and focus on getting the frontend (lexer/parser/IR) to handle real C.                           │
│                                                                                                        │
│ Changes (in priority order)                                                                            │
│                                                                                                        │
│ 1. Lexer: Add missing keywords and operators                                                           │
│                                                                                                        │
│ File: src/lexer/Lexer.ts                                                                               │
│ - Add keywords: enum, union, extern, const, inline, do, goto, register, auto, _Bool, float, double,    │
│ restrict, _Noreturn, _Alignas, _Alignof, _Static_assert, _Thread_local, __attribute__, __extension__,  │
│ __typeof__, __inline__, __restrict__                                                                   │
│ - Add compound assignment operators: +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=                          │
│ - Add arrow operator: ->                                                                               │
│ - Add ellipsis: ...                                                                                    │
│ - Add tilde: ~ (already in TokenType but not in operator parsing)                                      │
│ - Handle # directives that aren't at column 1 (preprocessed code has # linenum "file" markers)         │
│                                                                                                        │
│ 2. Parser: Add missing AST nodes and parsing                                                           │
│                                                                                                        │
│ File: src/parser/Parser.ts                                                                             │
│ - Compound assignment: +=, -=, *=, etc. — desugar to x = x op y in parser or keep as new AST node      │
│ - Ternary operator ?: — add TERNARY_EXPRESSION node, parse in parseAssignment() between assignment and │
│  logical-or                                                                                            │
│ - Comma operator — parse in parseExpression() as lowest-precedence binary operator                     │
│ - do-while — add DO_WHILE_STATEMENT node                                                               │
│ - goto/labels — add GOTO_STATEMENT and LABEL_STATEMENT nodes                                           │
│ - enum — add ENUM_DECLARATION node, parse enum body with optional values                               │
│ - union — reuse struct parsing with union keyword                                                      │
│ - extern declarations — handle extern as storage class, allow function declarations without bodies     │
│ - const/volatile/restrict — parse as type qualifiers (store on TypeSpecifierNode)                      │
│ - inline/inline — parse and store as function attribute                                                │
│ - attribute((...)) — skip/consume double-parens with nesting                                           │
│ - Arrow operator -> — parse as member access on pointer (desugar: p->m = (*p).m)                       │
│ - Variadic params ... — allow in parameter list                                                        │
│ - Designated initializers {.field = val} — parse initializer lists                                     │
│ - Function pointers in types and declarations                                                          │
│ - Forward declarations — function declarations ending with ; instead of body                           │
│ - Multiple declarators — int a, b, c;                                                                  │
│ - Bitwise operators &, |, ^ in expression precedence (currently missing from precedence chain between  │
│ equality and shift)                                                                                    │
│ - Static/extern at top level — handle storage class specifiers before type                             │
│ - Typedefs with identifiers as types — parser already handles this partially, needs to work at top     │
│ level too                                                                                              │
│                                                                                                        │
│ 3. IR Generator: Support new AST nodes                                                                 │
│                                                                                                        │
│ File: src/codegen/IRGenerator.ts                                                                       │
│ - Add bitwise IR opcodes: SHL, SHR, BAND, BOR, BXOR, BNOT                                              │
│ - Handle compound assignments (desugar to load-op-store)                                               │
│ - Handle ternary expressions (conditional select)                                                      │
│ - Handle do-while loops                                                                                │
│ - Handle goto/labels (jump to named labels)                                                            │
│ - Handle enum constants (treat as integer constants)                                                   │
│ - Handle string literals (allocate in .rodata, return pointer)                                         │
│ - Basic handling for new node types (pass-through for attributes, extern, etc.)                        │
│                                                                                                        │
│ 4. Update compile.ts for external preprocessing                                                        │
│                                                                                                        │
│ File: src/compile.ts                                                                                   │
│ - Add -E flag pass-through to gcc for preprocessing                                                    │
│ - Handle # linenum "filename" line markers in preprocessed output (skip or track for error messages)   │
│ - Reduce verbose output (don't print full source/IR for large files)                                   │
│                                                                                                        │
│ Files to modify                                                                                        │
│                                                                                                        │
│ 1. src/lexer/Lexer.ts — new tokens, keywords, operators                                                │
│ 2. src/parser/Parser.ts — new AST nodes, parsing rules                                                 │
│ 3. src/codegen/IR.ts — new IR opcodes (bitwise ops)                                                    │
│ 4. src/codegen/IRGenerator.ts — handle new AST nodes                                                   │
│ 5. src/compile.ts — preprocessing integration, quieter output                                          │
│                                                                                                        │
│ Verification                                                                                           │
│                                                                                                        │
│ 1. Build: npx tsc (must compile without errors)                                                        │
│ 2. Test with simple C files using new features (enum, compound assign, ternary, etc.)                  │
│ 3. Preprocess a kernel file: gcc -E -I linux-6.18/include ... kernel/bounds.c                          │
│ 4. Attempt to parse the preprocessed output and see how far we get                                     │
│ 5. Iterate on the next batch of errors