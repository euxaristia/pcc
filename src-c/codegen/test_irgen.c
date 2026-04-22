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

#define ASSERT_STR_CONTAINS(haystack, needle) do { \
    if (!strstr((haystack), (needle))) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: expected string to contain '%s'\n", (needle)); \
        return; \
    } \
} while(0)

static IRModule *generate_ir(const char *code) {
    Lexer l;
    lexer_init(&l, code);
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    Parser p;
    parser_init(&p, toks, count);
    ASTNode *ast = parser_parse(&p);
    
    IRGenerator *gen = irgen_create();
    IRModule *mod = irgen_generate(gen, ast);
    
    /* Don't free gen so mod stays valid; caller must use ir_module_free later */
    /* But we need to keep gen alive... let's just return mod and leak gen for tests */
    (void)gen;
    tokens_free(toks, count);
    return mod;
}

/* ======================================================================== */

TEST(simple_function) {
    IRModule *mod = generate_ir("int main() { return 42; }");
    ASSERT_EQ(mod->num_functions, 1);
    ASSERT(strcmp(mod->functions[0]->name, "main") == 0);
    ASSERT(mod->functions[0]->return_type == IR_I32);
    ASSERT_EQ(mod->functions[0]->num_params, 0);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "define i32 @main()");
    ASSERT_STR_CONTAINS(s, "ret 42");
    ir_module_free(mod);
}

TEST(function_with_params) {
    IRModule *mod = generate_ir("int add(int a, int b) { return a + b; }");
    ASSERT_EQ(mod->num_functions, 1);
    IRFunction *f = mod->functions[0];
    ASSERT(strcmp(f->name, "add") == 0);
    ASSERT_EQ(f->num_params, 2);
    ASSERT(strcmp(f->params[0].name, "a") == 0);
    ASSERT(strcmp(f->params[1].name, "b") == 0);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "define i32 @add(i32 a, i32 b)");
    ir_module_free(mod);
}

TEST(variable_declarations) {
    IRModule *mod = generate_ir("int main(void) { int x = 5; int y = 10; return x + y; }");
    IRFunction *f = mod->functions[0];
    ASSERT_EQ(f->num_locals, 2);
    int has_x = 0, has_y = 0;
    for (int i = 0; i < f->num_locals; i++) {
        if (strcmp(f->locals[i].name, "x") == 0) has_x = 1;
        if (strcmp(f->locals[i].name, "y") == 0) has_y = 1;
    }
    ASSERT(has_x && has_y);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "alloca i32");
    ASSERT_STR_CONTAINS(s, "store");
    ASSERT_STR_CONTAINS(s, "load");
    ir_module_free(mod);
}

TEST(binary_expressions) {
    IRModule *mod = generate_ir("int main(void) { int a = 2; int b = 3; int c = a + b * 4; return c; }");
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "mul");
    ASSERT_STR_CONTAINS(s, "add");
    ir_module_free(mod);
}

TEST(comparison_expressions) {
    IRModule *mod = generate_ir("int main(void) { int a = 5; int b = 3; int c = a > b; return c; }");
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "gt");
    ir_module_free(mod);
}

TEST(function_call) {
    IRModule *mod = generate_ir(
        "int add(int a, int b) { return a + b; }"
        "int main(void) { int result = add(5, 3); return result; }"
    );
    ASSERT_EQ(mod->num_functions, 2);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "call add");
    ir_module_free(mod);
}

TEST(if_statement) {
    IRModule *mod = generate_ir(
        "int main(void) { int x = 5; if (x > 0) { return 1; } else { return 0; } }"
    );
    IRFunction *f = mod->functions[0];
    ASSERT(f->num_blocks > 1);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "jump_if");
    ASSERT_STR_CONTAINS(s, "then_");
    ASSERT_STR_CONTAINS(s, "else_");
    ASSERT_STR_CONTAINS(s, "merge_");
    ir_module_free(mod);
}

TEST(while_loop) {
    IRModule *mod = generate_ir(
        "int main(void) { int i = 0; while (i < 5) { i = i + 1; } return i; }"
    );
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "while.cond");
    ASSERT_STR_CONTAINS(s, "while.body");
    ASSERT_STR_CONTAINS(s, "while.after");
    ASSERT_STR_CONTAINS(s, "jump");
    ir_module_free(mod);
}

TEST(for_loop) {
    IRModule *mod = generate_ir(
        "int main(void) { int sum = 0; for (int i = 0; i < 5; i = i + 1) { sum = sum + i; } return sum; }"
    );
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "for.cond");
    ASSERT_STR_CONTAINS(s, "for.body");
    ASSERT_STR_CONTAINS(s, "for.inc");
    ASSERT_STR_CONTAINS(s, "for.after");
    ir_module_free(mod);
}

TEST(global_variable) {
    IRModule *mod = generate_ir(
        "int global_var = 42;"
        "int main(void) { return global_var; }"
    );
    ASSERT_EQ(mod->num_globals, 1);
    ASSERT(strcmp(mod->globals[0]->name, "global_var") == 0);
    ASSERT(mod->globals[0]->type == IR_I32);
    ASSERT(mod->globals[0]->initializer != NULL);
    ASSERT_EQ((int)mod->globals[0]->initializer->value, 42);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "@global_var = global i32 42");
    ir_module_free(mod);
}

TEST(factorial_function) {
    IRModule *mod = generate_ir(
        "int factorial(int n) {"
        "  if (n <= 1) { return 1; }"
        "  else { return n * factorial(n - 1); }"
        "}"
        "int main(void) {"
        "  int result = factorial(5);"
        "  return result;"
        "}"
    );
    ASSERT_EQ(mod->num_functions, 2);
    IRFunction *fact = NULL;
    for (int i = 0; i < mod->num_functions; i++) {
        if (strcmp(mod->functions[i]->name, "factorial") == 0) {
            fact = mod->functions[i];
            break;
        }
    }
    ASSERT(fact != NULL);
    ASSERT_EQ(fact->num_params, 1);
    ASSERT(fact->num_blocks > 1);
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "le");
    ASSERT_STR_CONTAINS(s, "sub");
    ASSERT_STR_CONTAINS(s, "mul");
    ASSERT_STR_CONTAINS(s, "call factorial");
    ir_module_free(mod);
}

TEST(multiple_signatures) {
    IRModule *mod = generate_ir(
        "char get_char(void) { return 'a'; }"
        "void do_nothing(void) { return; }"
        "int compute(int x, int y) { int sum = x + y; return sum; }"
    );
    ASSERT_EQ(mod->num_functions, 3);
    
    IRFunction *get_char = NULL, *do_nothing = NULL, *compute = NULL;
    for (int i = 0; i < mod->num_functions; i++) {
        if (strcmp(mod->functions[i]->name, "get_char") == 0) get_char = mod->functions[i];
        if (strcmp(mod->functions[i]->name, "do_nothing") == 0) do_nothing = mod->functions[i];
        if (strcmp(mod->functions[i]->name, "compute") == 0) compute = mod->functions[i];
    }
    ASSERT(get_char && get_char->return_type == IR_I8 && get_char->num_params == 0);
    ASSERT(do_nothing && do_nothing->return_type == IR_VOID && do_nothing->num_params == 0);
    ASSERT(compute && compute->return_type == IR_I32 && compute->num_params == 2);
    ir_module_free(mod);
}

TEST(pointer_dereference) {
    IRModule *mod = generate_ir(
        "int main(void) { int x = 1; int *p = &x; return *p; }"
    );
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "load");
    ir_module_free(mod);
}

TEST(do_while_loop) {
    IRModule *mod = generate_ir(
        "int main(void) { int i = 0; do { i = i + 1; } while (i < 5); return i; }"
    );
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "do_while.body");
    ASSERT_STR_CONTAINS(s, "do_while.cond");
    ir_module_free(mod);
}

TEST(ternary_expression) {
    IRModule *mod = generate_ir(
        "int main(void) { int x = 1 ? 2 : 3; return x; }"
    );
    char *s = ir_pretty_print(mod);
    ASSERT_STR_CONTAINS(s, "ternary_true");
    ASSERT_STR_CONTAINS(s, "ternary_false");
    ir_module_free(mod);
}

/* ======================================================================== */

int main(void) {
    printf("Running C IR generator tests...\n\n");

    RUN(simple_function);
    RUN(function_with_params);
    RUN(variable_declarations);
    RUN(binary_expressions);
    RUN(comparison_expressions);
    RUN(function_call);
    RUN(if_statement);
    RUN(while_loop);
    RUN(for_loop);
    RUN(global_variable);
    RUN(factorial_function);
    RUN(multiple_signatures);
    RUN(pointer_dereference);
    RUN(do_while_loop);
    RUN(ternary_expression);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n",
           tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
