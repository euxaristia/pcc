#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "preprocessor/pp.h"
#include "lexer/lexer.h"
#include "parser/parser.h"
#include "semantic/semantic.h"
#include "codegen/irgen.h"
#include "codegen/asmgen.h"
#include "codegen/asmgen_arm64.h"
#include "codegen/elf.h"

typedef struct {
    char   *source_files[64];
    int     num_source_files;
    char   *output_file;
    int     compile_only;
    int     preprocess_only;
    int     emit_assembly;
    char   *include_paths[64];
    int     num_include_paths;
    char   *defines[64];
    int     num_defines;
    int     verbose;
    char   *arch;
    int     werror;
} Options;

static void parse_args(int argc, char **argv, Options *opts) {
    memset(opts, 0, sizeof(*opts));
    opts->arch = "x86-64";
    if (getenv("PCC_VERBOSE")) opts->verbose = 1;

    for (int i = 1; i < argc; i++) {
        char *arg = argv[i];
        if (strcmp(arg, "-h") == 0 || strcmp(arg, "--help") == 0) {
            printf("Usage: pcc [options] <source.c>\n"
                   "Options:\n"
                   "  -o <file>         Output file\n"
                   "  -c                Compile to object file\n"
                   "  -S                Compile to assembly\n"
                   "  -E                Preprocess only\n"
                   "  -I <path>         Include path\n"
                   "  -D <def>          Define macro\n"
                   "  --arch=<arch>     Target arch (x86-64, arm64)\n"
                   "  -Werror           Treat warnings as errors\n"
                   "  --verbose         Verbose output\n"
                   "  -h, --help        Help\n");
            exit(0);
        } else if (strcmp(arg, "-c") == 0) {
            opts->compile_only = 1;
        } else if (strcmp(arg, "-S") == 0) {
            opts->emit_assembly = 1;
        } else if (strcmp(arg, "-E") == 0) {
            opts->preprocess_only = 1;
        } else if (strcmp(arg, "-o") == 0) {
            if (i + 1 < argc) opts->output_file = argv[++i];
            else { fprintf(stderr, "Error: -o needs arg\n"); exit(1); }
        } else if (strncmp(arg, "-I", 2) == 0) {
            const char *ipath = arg[2] ? arg + 2 : (i + 1 < argc ? argv[++i] : NULL);
            if (ipath) { if (opts->num_include_paths >= 64) { fprintf(stderr, "Error: too many -I paths\n"); exit(1); } opts->include_paths[opts->num_include_paths++] = (char*)ipath; }
        } else if (strncmp(arg, "-D", 2) == 0) {
            const char *def = arg[2] ? arg + 2 : (i + 1 < argc ? argv[++i] : NULL);
            if (def) { if (opts->num_defines >= 64) { fprintf(stderr, "Error: too many -D defines\n"); exit(1); } opts->defines[opts->num_defines++] = (char*)def; }
        } else if (strncmp(arg, "--arch=", 7) == 0) {
            opts->arch = arg + 7;
        } else if (strcmp(arg, "-Werror") == 0) {
            opts->werror = 1;
        } else if (strcmp(arg, "--verbose") == 0) {
            opts->verbose = 1;
        } else if (arg[0] == '-') {
            fprintf(stderr, "Unknown option: %s\n", arg);
            exit(1);
        } else {
            if (opts->num_source_files >= 64) { fprintf(stderr, "Error: too many input files\n"); exit(1); }
            opts->source_files[opts->num_source_files++] = arg;
        }
    }

    if (opts->num_source_files == 0) {
        fprintf(stderr, "Error: no input files\n");
        exit(1);
    }
}

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) { perror(path); return NULL; }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    if (sz < 0) { perror("ftell"); fclose(f); return NULL; }
    fseek(f, 0, SEEK_SET);
    char *buf = malloc((size_t)sz + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t n = fread(buf, 1, (size_t)sz, f);
    buf[n] = '\0';
    fclose(f);
    return buf;
}

int main(int argc, char **argv) {
    Options opts;
    parse_args(argc, argv, &opts);

    for (int fi = 0; fi < opts.num_source_files; fi++) {
        char *source_file = opts.source_files[fi];

        char *source = read_file(source_file);
        if (!source) return 1;

        if (opts.verbose) fprintf(stderr, "=== Compiling %s ===\n", source_file);

        /* Determine output path */
        char outname[1024];
        const char *output_path = NULL;
        if (opts.output_file && opts.num_source_files == 1) {
            output_path = opts.output_file;
        } else {
            const char *base = source_file;
            const char *dot = strrchr(base, '.');
            if (!dot) dot = base + strlen(base);
            size_t prefix = dot - base;
            if (prefix >= sizeof(outname)) prefix = sizeof(outname) - 1;
            memcpy(outname, base, prefix);
            if (opts.preprocess_only) snprintf(outname + prefix, sizeof(outname) - prefix, ".i");
            else if (opts.emit_assembly) snprintf(outname + prefix, sizeof(outname) - prefix, ".s");
            else snprintf(outname + prefix, sizeof(outname) - prefix, ".o");
            output_path = outname;
        }

        /* Phase 0: Preprocessing */
        if (opts.verbose) fprintf(stderr, "=== Phase 0: Preprocessing ===\n");
        const char **inc_paths = (const char **)opts.include_paths;
        const char **defs = (const char **)opts.defines;
        char *preprocessed = preprocess(source, source_file,
                                         inc_paths, opts.num_include_paths,
                                         defs, opts.num_defines);
        free(source);
        if (!preprocessed) {
            fprintf(stderr, "Preprocessing failed\n");
            return 1;
        }
        if (opts.verbose) {
            int lines = 0;
            for (const char *p = preprocessed; *p; p++) if (*p == '\n') lines++;
            fprintf(stderr, "Preprocessed %d lines\n", lines);
        }

        if (opts.preprocess_only) {
            if (opts.output_file && strcmp(opts.output_file, "-") == 0) {
                printf("%s\n", preprocessed);
            } else {
                FILE *f = fopen(output_path, "w");
                if (!f) { perror(output_path); return 1; }
                fprintf(f, "%s\n", preprocessed);
                fclose(f);
                if (opts.verbose) fprintf(stderr, "Preprocessed output to %s\n", output_path);
            }
            pp_result_free(preprocessed);
            continue;
        }

        /* Phase 1: Lex */
        if (opts.verbose) fprintf(stderr, "=== Phase 1: Lexical Analysis ===\n");
        Lexer lex;
        lexer_init(&lex, preprocessed);
        int num_tokens;
        Token **tokens = lexer_tokenize(&lex, &num_tokens);
        if (opts.verbose) fprintf(stderr, "Generated %d tokens\n", num_tokens);

        /* Phase 2: Parse */
        if (opts.verbose) fprintf(stderr, "=== Phase 2: Parsing ===\n");
        Parser parser;
        parser_init(&parser, tokens, num_tokens);
        ASTNode *ast = parser_parse(&parser);
        if (parser.error) {
            fprintf(stderr, "Parse errors encountered. Aborting.\n");
            tokens_free(tokens, num_tokens);
            ast_free(ast);
            pp_result_free(preprocessed);
            return 1;
        }
        if (opts.verbose) fprintf(stderr, "Parsed AST\n");

        /* Phase 3: Semantic Analysis */
        if (opts.verbose) fprintf(stderr, "=== Phase 3: Semantic Analysis ===\n");
        SemanticAnalyzer sema;
        sema_init(&sema);
        sema_analyze(&sema, ast);

        if (sema.errors.len > 0) {
            fprintf(stderr, "Semantic errors:\n");
            for (size_t i = 0; i < sema.errors.len; i++) {
                fprintf(stderr, "  %zu. %s (line %d, col %d)\n",
                        i + 1, sema.errors.errors[i]->message,
                        sema.errors.errors[i]->line, sema.errors.errors[i]->column);
            }
            fprintf(stderr, "Compilation aborted due to errors\n");
            sema_free(&sema);
            return 1;
        }

        /* Phase 4: IR Generation */
        if (opts.verbose) fprintf(stderr, "=== Phase 4: IR Generation ===\n");
        IRGenerator *irgen = irgen_create();
        IRModule *module = irgen_generate(irgen, ast);
        if (opts.verbose) fprintf(stderr, "Generated IR with %d functions\n", module->num_functions);

        /* Phase 5: Assembly Generation */
        if (opts.verbose) fprintf(stderr, "=== Phase 5: Assembly Generation ===\n");
        char *assembly = NULL;
        if (strcmp(opts.arch, "arm64") == 0 || strcmp(opts.arch, "aarch64") == 0) {
            assembly = arm64_generate_assembly(module);
        } else {
            assembly = x8664_generate_assembly(module);
        }
        if (opts.verbose) fprintf(stderr, "Generated assembly\n");

        if (opts.emit_assembly) {
            FILE *f = fopen(output_path, "w");
            if (!f) { perror(output_path); return 1; }
            fprintf(f, "%s", assembly);
            fclose(f);
            if (opts.verbose) fprintf(stderr, "Assembly written to %s\n", output_path);
            free(assembly);
            irgen_free(irgen);
            sema_free(&sema);
            ast_free(ast);
            tokens_free(tokens, num_tokens);
            pp_result_free(preprocessed);
            continue;
        }

        /* Phase 6: ELF Generation */
        if (opts.verbose) fprintf(stderr, "=== Phase 6: ELF Generation ===\n");
        AssemblyProgram *ap = parse_assembly(assembly);
        size_t elf_len;
        unsigned char *elf_buf = generate_elf(ap, opts.arch, &elf_len);
        free_assembly_program(ap);

        FILE *f = fopen(output_path, "wb");
        if (!f) { perror(output_path); return 1; }
        fwrite(elf_buf, 1, elf_len, f);
        fclose(f);

        if (opts.verbose) {
            fprintf(stderr, "Successfully compiled to %s\n", output_path);
            fprintf(stderr, "ELF file size: %zu bytes\n", elf_len);
        }

        free(elf_buf);
        free(assembly);
        irgen_free(irgen);
        sema_free(&sema);
        ast_free(ast);
        tokens_free(tokens, num_tokens);
        pp_result_free(preprocessed);
    }

    return 0;
}
