#include "elf.h"
#include "asmgen.h"
#include "irgen.h"
#include "ir.h"
#include "../parser/parser.h"
#include "../lexer/lexer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int tests_run = 0;
static int tests_passed = 0;
static int tests_failed = 0;
static int current_test_failed = 0;

#define TEST(name) static void test_##name(void)
#define RUN(name) do { \
    tests_run++; \
    printf("  test_" #name " ... "); \
    fflush(stdout); \
    current_test_failed = 0; \
    test_##name(); \
    if (!current_test_failed) { \
        tests_passed++; \
        printf("PASS\n"); \
    } \
} while(0)

#define FAIL(msg) do { \
    if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
    printf("FAIL: %s\n", msg); \
    return; \
} while(0)

#define ASSERT(cond) do { \
    if (!(cond)) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: assertion failed: %s\n", #cond); \
        return; \
    } \
} while(0)

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: expected %d, got %d\n", (int)(b), (int)(a)); \
        return; \
    } \
} while(0)

static unsigned char *generate_elf_bytes(const char *code, const char *arch, size_t *out_len) {
    Lexer l;
    lexer_init(&l, code);
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    Parser p;
    parser_init(&p, toks, count);
    ASTNode *ast = parser_parse(&p);

    IRGenerator *gen = irgen_create();
    IRModule *mod = irgen_generate(gen, ast);

    char *assembly = x8664_generate_assembly(mod);
    AssemblyProgram *ap = parse_assembly(assembly);
    unsigned char *elf = generate_elf(ap, arch, out_len);

    free(assembly);
    free_assembly_program(ap);
    ir_module_free(mod);
    tokens_free(toks, count);
    return elf;
}

TEST(elf_magic) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    ASSERT_EQ(elf[0], 0x7F);
    ASSERT_EQ(elf[1], 'E');
    ASSERT_EQ(elf[2], 'L');
    ASSERT_EQ(elf[3], 'F');
    free(elf);
}

TEST(elf_64bit) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    ASSERT_EQ(elf[4], 2);
    free(elf);
}

TEST(elf_little_endian) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    ASSERT_EQ(elf[5], 1);
    free(elf);
}

TEST(elf_x86_64_machine) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    ASSERT_EQ(elf[18], 0x3E);
    ASSERT_EQ(elf[19], 0x00);
    free(elf);
}

TEST(elf_relocatable_type) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    ASSERT_EQ(elf[16], 0x01);
    ASSERT_EQ(elf[17], 0x00);
    free(elf);
}

TEST(elf_section_header_offset) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    unsigned int shoff = elf[40] | (elf[41] << 8) | (elf[42] << 16) | (elf[43] << 24);
    ASSERT(shoff > 64);
    free(elf);
}

TEST(elf_has_instructions) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    int found_push_rbp = 0, found_ret = 0;
    for (size_t i = 0; i < len - 1; i++) {
        if (elf[i] == 0x55) found_push_rbp = 1;
        if (elf[i] == 0xC3) found_ret = 1;
    }
    ASSERT(found_push_rbp);
    ASSERT(found_ret);
    free(elf);
}

TEST(elf_data_section) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int g = 12345; int main() { return g; }", "x86-64", &len);
    int found_value = 0;
    for (size_t i = 0; i < len - 4; i++) {
        if (elf[i] == 0x39 && elf[i+1] == 0x30 && elf[i+2] == 0x00 && elf[i+3] == 0x00) {
            found_value = 1; break;
        }
    }
    ASSERT(found_value);
    free(elf);
}

TEST(elf_section_count) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    unsigned int shnum = elf[60] | (elf[61] << 8);
    ASSERT(shnum >= 2);
    free(elf);
}

TEST(elf_string_table) {
    size_t len;
    unsigned char *elf = generate_elf_bytes("int main() { return 42; }", "x86-64", &len);
    unsigned int shstrndx = elf[62] | (elf[63] << 8);
    ASSERT(shstrndx > 0);
    free(elf);
}

TEST(elf_consistency) {
    size_t len1, len2;
    unsigned char *elf1 = generate_elf_bytes("int main() { return 42; }", "x86-64", &len1);
    unsigned char *elf2 = generate_elf_bytes("int main() { return 42; }", "x86-64", &len2);
    ASSERT_EQ(len1, len2);
    for (size_t i = 0; i < len1; i++) ASSERT_EQ(elf1[i], elf2[i]);
    free(elf1); free(elf2);
}

TEST(elf_different_programs) {
    size_t len1, len2;
    unsigned char *elf1 = generate_elf_bytes("int main() { return 1; }", "x86-64", &len1);
    unsigned char *elf2 = generate_elf_bytes("int g = 42; int main() { return g; }", "x86-64", &len2);
    int diff = 0;
    for (size_t i = 0; i < (len1 < len2 ? len1 : len2); i++) {
        if (elf1[i] != elf2[i]) { diff = 1; break; }
    }
    ASSERT(diff);
    free(elf1); free(elf2);
}

int main(void) {
    printf("Running C ELF generator tests...\n\n");

    RUN(elf_magic);
    RUN(elf_64bit);
    RUN(elf_little_endian);
    RUN(elf_x86_64_machine);
    RUN(elf_relocatable_type);
    RUN(elf_section_header_offset);
    RUN(elf_has_instructions);
    RUN(elf_data_section);
    RUN(elf_section_count);
    RUN(elf_string_table);
    RUN(elf_consistency);
    RUN(elf_different_programs);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n", tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
