import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const COMPILE_CMD = 'bun run src/compile.ts';
const TMP_DIR = '/tmp/pcc_cli_test';

function run(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`${COMPILE_CMD} ${args}`, { encoding: 'utf-8', cwd: process.cwd() });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status || 1,
    };
  }
}

function tmpFile(name: string): string {
  return join(TMP_DIR, name);
}

beforeAll(() => {
  try {
    execSync(`mkdir -p ${TMP_DIR}`);
  } catch {}
});

afterEach(() => {
  // Clean up temp files
  const files = ['simple.c', 'test.o', 'test.s', 'test.i', 'header.h', 'out.o', 'macro.c'];
  files.forEach(f => {
    try { unlinkSync(tmpFile(f)); } catch {}
  });
});

describe('CLI argument parsing', () => {
  it('should show help with --help', () => {
    const result = run('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('-o <file>');
    expect(result.stdout).toContain('-c');
    expect(result.stdout).toContain('-S');
    expect(result.stdout).toContain('-E');
    expect(result.stdout).toContain('-I');
    expect(result.stdout).toContain('-D');
  });

  it('should show version with --version', () => {
    const result = run('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Pickle C Compiler');
  });

  it('should error when no input files given', () => {
    const result = run('-c');
    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toContain('no input files');
  });

  it('should error on unrecognized options', () => {
    writeFileSync(tmpFile('simple.c'), `int main() { return 42; }\n`);
    const result = run(`-c --unknown-flag -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toContain('unrecognized option');
  });

  it('should error when -o is used with multiple source files', () => {
    writeFileSync(tmpFile('a.c'), `int main() { return 42; }\n`);
    writeFileSync(tmpFile('b.c'), `int foo() { return 1; }\n`);
    const result = run(`-c -o ${tmpFile('out.o')} ${tmpFile('a.c')} ${tmpFile('b.c')}`);
    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toContain('cannot specify -o with multiple source files');
  });
});

describe('Compilation modes', () => {
  const simpleC = `int main() { return 42; }\n`;

  it('should compile to object file by default', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    expect(existsSync(tmpFile('simple.o'))).toBe(true);
  });

  it('should compile to object with -c', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    expect(existsSync(tmpFile('test.o'))).toBe(true);
  });

  it('should emit assembly with -S', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-S -o ${tmpFile('test.s')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    expect(existsSync(tmpFile('test.s'))).toBe(true);
    const asm = readFileSync(tmpFile('test.s'), 'utf-8');
    expect(asm).toContain('.text');
    expect(asm).toContain('main:');
  });

  it('should preprocess with -E', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-E -o ${tmpFile('test.i')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    expect(existsSync(tmpFile('test.i'))).toBe(true);
    const preprocessed = readFileSync(tmpFile('test.i'), 'utf-8');
    expect(preprocessed).toContain('int main()');
  });
});

describe('Preprocessor flags', () => {
  it('should define macros with -D', () => {
    writeFileSync(tmpFile('macro.c'), `#ifdef FOO\nint x = 1;\n#else\nint x = 0;\n#endif\nint main() { return x; }\n`);
    const result = run(`-E -D FOO -o ${tmpFile('test.i')} ${tmpFile('macro.c')}`);
    expect(result.exitCode).toBe(0);
    const preprocessed = readFileSync(tmpFile('test.i'), 'utf-8');
    expect(preprocessed).toContain('int x = 1;');
    expect(preprocessed).not.toContain('int x = 0;');
  });

  it('should define macros with -Dname=value', () => {
    writeFileSync(tmpFile('macro.c'), `int main() { return VAL; }\n`);
    const result = run(`-E -D VAL=99 -o ${tmpFile('test.i')} ${tmpFile('macro.c')}`);
    expect(result.exitCode).toBe(0);
    const preprocessed = readFileSync(tmpFile('test.i'), 'utf-8');
    expect(preprocessed).toContain('return 99;');
  });

  it('should add include paths with -I', () => {
    writeFileSync(tmpFile('header.h'), `#define VAL 123\n`);
    writeFileSync(tmpFile('macro.c'), `#include "header.h"\nint main() { return VAL; }\n`);
    const result = run(`-E -I ${TMP_DIR} -o ${tmpFile('test.i')} ${tmpFile('macro.c')}`);
    expect(result.exitCode).toBe(0);
    const preprocessed = readFileSync(tmpFile('test.i'), 'utf-8');
    expect(preprocessed).toContain('return 123;');
  });
});

describe('Warning and optimization flags', () => {
  const simpleC = `int main() { return 42; }\n`;

  it('should accept -Wall without error', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -Wall -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
  });

  it('should accept -Werror without error on clean code', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -Werror -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
  });

  it('should accept -O2 and note unimplemented optimization', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -O2 -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
  });

  it('should accept -std=c11', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -std=c11 -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
  });

  it('should accept -g and note unimplemented debug info', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c -g -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
  });
});

describe('Architecture flag', () => {
  const simpleC = `int main() { return 42; }\n`;

  it('should accept --arch=arm64', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-S --arch=arm64 -o ${tmpFile('test.s')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    const asm = readFileSync(tmpFile('test.s'), 'utf-8');
    // ARM64 assembly should not contain x86-64 push rbp
    expect(asm).not.toContain('push rbp');
  });
});

describe('Verbose and token flags', () => {
  const simpleC = `int main() { return 42; }\n`;

  it('should print phase info with --verbose', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c --verbose -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Compiling');
    expect(result.stdout).toContain('Phase 0:');
    expect(result.stdout).toContain('Phase 1:');
  });

  it('should print tokens with --tokens', () => {
    writeFileSync(tmpFile('simple.c'), simpleC);
    const result = run(`-c --tokens -o ${tmpFile('test.o')} ${tmpFile('simple.c')}`);
    expect(result.exitCode).toBe(0);
    // Tokens are printed to stdout regardless of verbose
    expect(result.stdout).toContain('IDENTIFIER');
    expect(result.stdout).toContain('NUMBER');
  });
});
