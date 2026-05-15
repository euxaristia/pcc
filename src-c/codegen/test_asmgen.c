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

#define ASSERT_STR_CONTAINS(haystack, needle) do { \
    if (!strstr((haystack), (needle))) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: expected string to contain '%s'\n", (needle)); \
        return; \
    } \
} while(0)

static char *generate_assembly(const char *code) {
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

    tokens_free(toks, count);
    ir_module_free(mod);
    return assembly;
}

TEST(simple_function) {
    char *a = generate_assembly("int main() { return 42; }");
    ASSERT_STR_CONTAINS(a, ".text");
    ASSERT_STR_CONTAINS(a, ".globl main");
    ASSERT_STR_CONTAINS(a, "main:");
    ASSERT_STR_CONTAINS(a, "push rbp");
    ASSERT_STR_CONTAINS(a, "ret");
    ASSERT_STR_CONTAINS(a, "$42");
    free(a);
}

TEST(function_with_params) {
    char *a = generate_assembly("int add(int a, int b) { return a + b; }");
    ASSERT_STR_CONTAINS(a, ".globl add");
    ASSERT_STR_CONTAINS(a, "add:");
    ASSERT_STR_CONTAINS(a, "add");
    free(a);
}

TEST(local_variables) {
    char *a = generate_assembly("int main() { int x = 5; int y = 10; return x + y; }");
    ASSERT_STR_CONTAINS(a, "sub $");
    ASSERT_STR_CONTAINS(a, "rbp -");
    ASSERT_STR_CONTAINS(a, "$5");
    ASSERT_STR_CONTAINS(a, "$10");
    free(a);
}

TEST(global_variable) {
    char *a = generate_assembly("int g = 42; int main() { return g; }");
    ASSERT_STR_CONTAINS(a, ".data");
    ASSERT_STR_CONTAINS(a, ".globl g");
    ASSERT_STR_CONTAINS(a, "g:");
    ASSERT_STR_CONTAINS(a, ".long 42");
    free(a);
}

TEST(arithmetic_expr) {
    char *a = generate_assembly("int main() { int a = 2; int b = 3; int c = a + b * 4; return c; }");
    ASSERT_STR_CONTAINS(a, "imul");
    ASSERT_STR_CONTAINS(a, "add");
    free(a);
}

TEST(comparison_expr) {
    char *a = generate_assembly("int main() { int a = 5; int b = 3; int c = a > b; return c; }");
    ASSERT_STR_CONTAINS(a, "cmp");
    ASSERT_STR_CONTAINS(a, "setg");
    free(a);
}

TEST(function_call) {
    char *a = generate_assembly("int add(int a, int b) { return a + b; } int main() { return add(5, 3); }");
    ASSERT_STR_CONTAINS(a, "call add");
    free(a);
}

TEST(if_statement) {
    char *a = generate_assembly("int main() { int x = 5; if (x > 0) return 1; else return 0; }");
    ASSERT_STR_CONTAINS(a, "cmp");
    ASSERT_STR_CONTAINS(a, "jne");
    ASSERT_STR_CONTAINS(a, "jmp");
    ASSERT_STR_CONTAINS(a, "then_");
    ASSERT_STR_CONTAINS(a, "else_");
    ASSERT_STR_CONTAINS(a, "merge_");
    free(a);
}

TEST(while_loop) {
    char *a = generate_assembly("int main() { int i = 0; while (i < 5) i = i + 1; return i; }");
    ASSERT_STR_CONTAINS(a, "while.cond");
    ASSERT_STR_CONTAINS(a, "while.body");
    ASSERT_STR_CONTAINS(a, "while.after");
    free(a);
}

TEST(for_loop) {
    char *a = generate_assembly("int main() { int s = 0; for (int i = 0; i < 5; i = i + 1) s = s + i; return s; }");
    ASSERT_STR_CONTAINS(a, "for.cond");
    ASSERT_STR_CONTAINS(a, "for.body");
    ASSERT_STR_CONTAINS(a, "for.inc");
    ASSERT_STR_CONTAINS(a, "for.after");
    free(a);
}

TEST(char_type) {
    char *a = generate_assembly("int main() { char c = 'a'; return c; }");
    ASSERT_STR_CONTAINS(a, "$97");
    free(a);
}

TEST(void_function) {
    char *a = generate_assembly("void f() { return; } int main() { f(); return 0; }");
    ASSERT_STR_CONTAINS(a, ".globl f");
    ASSERT_STR_CONTAINS(a, "call f");
    ASSERT_STR_CONTAINS(a, "ret");
    free(a);
}

int main(void) {
    printf("Running C x86-64 assembly generator tests...\n\n");

    RUN(simple_function);
    RUN(function_with_params);
    RUN(local_variables);
    RUN(global_variable);
    RUN(arithmetic_expr);
    RUN(comparison_expr);
    RUN(function_call);
    RUN(if_statement);
    RUN(while_loop);
    RUN(for_loop);
    RUN(char_type);
    RUN(void_function);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n", tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
