# Plan: Target xv6 Kernel Compilation

Targeting the Alpine Linux kernel was a 20% capability match. Switching focus to **xv6-public** provides a more realistic path to 100% compiler completeness. xv6 is ~9,000 lines of clean C code, but still requires several key features pcc lacks.

## Current Progress: ~70% for xv6

### Recently Completed ✅
- [x] **`__attribute__` parsing**: Added support for `__attribute__((...))` after function parameters
- [x] **`extern` storage class**: Added support for `extern` variable declarations  
- [x] **Basic conditional preprocessor**: Added support for `#if X64` / `#else` / `#endif` blocks

## Roadmap to xv6 Compilation

### Phase 1: Parser Robustness (The "Non-Standard" Gap)
- [ ] **`__attribute__` parsing**: Implement a parser for `__attribute__((...))`.
  - Initially, we can parse and ignore most attributes to unblock compilation.
  - Critical attributes like `__aligned__` should eventually be handled in the backend.
- [ ] **Designated Initializers**: Support `[index] = value` and `.member = value` in struct/array initializers.
  - Used heavily in `main.c` for `entrypgdir`.
- [ ] **Advanced Type Syntax**: 
  - [ ] Support function pointers: `void (*f)(void)`.
  - [ ] Support complex casts: `*(void(**)(void))(ptr)`.
- [ ] **Variadic Arguments**: Support `...` in function declarations (needed for `cprintf`).

### Phase 2: Inline Assembly & IO
- [ ] **Extended `asm` support**:
  - xv6 uses `asm volatile ("..." : output : input : clobbers)`.
  - pcc needs to parse these and (at least minimally) map the variables to the registers specified in the constraints (e.g., `a` for `eax`, `d` for `edx`).

### Phase 3: Semantic & IR Improvements
- [ ] **`static inline` functions**: Ensure these are handled correctly (local to translation unit, potentially not emitted if unused).
- [ ] **Void pointers**: Better handling of `void*` arithmetic and assignments.
- [ ] **Global Array Initializers**: Ensure large arrays like `entrypgdir` are correctly emitted in the `.data` section.

### Phase 4: Verification
- [ ] Attempt to compile `xv6/main.c` using `pcc`.
- [ ] Iterate through errors and implement missing features.
- [ ] Target: Successfully generate `main.o` that matches `gcc`'s structure.

## Next Immediate Task
Implement a parser for `__attribute__` in `src/parser/Parser.ts` to unblock basic xv6 files.
