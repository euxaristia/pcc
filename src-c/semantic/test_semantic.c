#include "semantic.h"
#include "../lexer/lexer.h"
#include "../parser/parser.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

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

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: expected %d, got %d\n", (int)(b), (int)(a)); \
        return; \
    } \
} while(0)

static ASTNode *parse_code(const char *code) {
    Lexer l;
    lexer_init(&l, code);
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    Parser p;
    parser_init(&p, toks, count);
    ASTNode *ast = parser_parse(&p);
    tokens_free(toks, count);
    return ast;
}

static int count_errors(const char *code) {
    ASTNode *ast = parse_code(code);
    SemanticAnalyzer sema;
    sema_init(&sema);
    sema_analyze(&sema, ast);
    int n = (int)sema.errors.len;
    sema_free(&sema);
    return n;
}

/* ======================================================================== */

TEST(empty_program) {
    ASSERT_EQ(count_errors(""), 0);
}

TEST(simple_function) {
    ASSERT_EQ(count_errors("int main(void) { return 0; }"), 0);
}

TEST(undeclared_variable) {
    ASSERT_EQ(count_errors("int main(void) { return x; }"), 1);
}

TEST(wrong_return_type) {
    /* double -> int is allowed via implicit conversion */
    ASSERT_EQ(count_errors("int main(void) { return 1.5; }"), 0);
}

TEST(void_function_with_return_value) {
    ASSERT_EQ(count_errors("void foo(void) { return 42; }"), 1);
}

TEST(function_call_undeclared) {
    ASSERT_EQ(count_errors("int main(void) { foo(); return 0; }"), 1);
}

TEST(scope_shadowing) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1; { int x = 2; } return x; }"), 0);
}

TEST(pointer_dereference) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1; int *p = &x; return *p; }"), 0);
}

TEST(invalid_dereference) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1; return *x; }"), 1);
}

TEST(type_mismatch_assignment) {
    ASSERT_EQ(count_errors("int main(void) { int x; x = \"hello\"; return 0; }"), 1);
}

TEST(return_outside_function) {
    ASSERT_EQ(count_errors("return 0;"), 1);
}

TEST(pointer_arithmetic_valid) {
    ASSERT_EQ(count_errors("int main(void) { int *p; p = p + 1; return 0; }"), 0);
}

TEST(null_pointer_assignment) {
    ASSERT_EQ(count_errors("int main(void) { int *p = 0; return 0; }"), 0);
}

/* Additional tests based on TS test suite */

TEST(valid_var_decls) {
    ASSERT_EQ(count_errors("int x; int y = 42; char c = 'a';"), 0);
}

TEST(type_mismatch_init) {
    /* int x = 'a' is allowed (char promotes to int), char c = 42 is allowed */
    ASSERT_EQ(count_errors("int main(void) { int x = 'a'; char c = 42; return 0; }"), 0);
}

TEST(duplicate_var_decl) {
    /* Duplicate declaration in same scope */
    ASSERT_EQ(count_errors("int main(void) { int x; int x = 5; return 0; }"), 1);
}

TEST(valid_func_with_params) {
    ASSERT_EQ(count_errors("int add(int a, int b) { return a + b; }"), 0);
}

TEST(duplicate_func_decl) {
    ASSERT_EQ(count_errors("int foo(void) { return 1; } int foo(void) { return 2; }"), 1);
}

TEST(duplicate_param_names) {
    ASSERT_EQ(count_errors("int test(int x, int x) { return x; }"), 1);
}

TEST(valid_binary_exprs) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1 + 2; int y = x * 3; return 0; }"), 0);
}

TEST(invalid_pointer_arithmetic) {
    /* p + p is invalid for pointers */
    ASSERT_EQ(count_errors("int main(void) { int *p = 0; int x = p + p; return 0; }"), 1);
}

TEST(valid_comparisons) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1; int y = 2; int z = x < y; return 0; }"), 0);
}

TEST(valid_assignment) {
    ASSERT_EQ(count_errors("int main(void) { int x = 5; x = 10; return 0; }"), 0);
}

TEST(invalid_assignment_pointer_to_int) {
    ASSERT_EQ(count_errors("int main(void) { int x = 5; int *p = &x; x = p; return 0; }"), 1);
}

TEST(use_undeclared_top_level) {
    ASSERT_EQ(count_errors("int x = y + 1;"), 1);
}

TEST(valid_function_call) {
    ASSERT_EQ(count_errors(
        "int add(int a, int b) { return a + b; }"
        "int main(void) { int result = add(1, 2); return result; }"
    ), 0);
}

TEST(wrong_arg_count) {
    ASSERT_EQ(count_errors(
        "int add(int a, int b) { return a + b; }"
        "int main(void) { return add(1); }"
    ), 1);
}

TEST(wrong_arg_type) {
    ASSERT_EQ(count_errors(
        "int add(int a, int b) { return a + b; }"
        "int main(void) { int *p = 0; return add(1, p); }"
    ), 1);
}

TEST(missing_return_value) {
    ASSERT_EQ(count_errors("int getInt(void) { return; }"), 1);
}

TEST(valid_if_statement) {
    ASSERT_EQ(count_errors(
        "int main(void) { int x = 1; if (x > 0) { return 1; } else { return 0; } }"
    ), 0);
}

TEST(valid_while_statement) {
    ASSERT_EQ(count_errors(
        "int main(void) { int i = 0; while (i < 10) { i = i + 1; } return i; }"
    ), 0);
}

TEST(valid_for_statement) {
    ASSERT_EQ(count_errors(
        "int main(void) { int sum = 0; for (int i = 0; i < 10; i = i + 1) { sum = sum + i; } return sum; }"
    ), 0);
}

TEST(global_scope_visibility) {
    ASSERT_EQ(count_errors("int x = 1; int main(void) { return x; }"), 0);
}

TEST(parameter_scope) {
    ASSERT_EQ(count_errors("int add(int a, int b) { return a + b; }"), 0);
}

TEST(factorial_program) {
    ASSERT_EQ(count_errors(
        "int factorial(int n) {"
        "  if (n <= 1) { return 1; }"
        "  else { return n * factorial(n - 1); }"
        "}"
        "int main(void) {"
        "  int result = factorial(5);"
        "  return result;"
        "}"
    ), 0);
}

TEST(empty_return_void) {
    ASSERT_EQ(count_errors("void foo(void) { return; }"), 0);
}

TEST(void_no_return) {
    ASSERT_EQ(count_errors("void foo(void) { }"), 0);
}

TEST(invalid_increment_pointer) {
    /* p * 2 is invalid for pointers */
    ASSERT_EQ(count_errors("int main(void) { int *p = 0; int x = p * 2; return 0; }"), 1);
}

TEST(bitwise_ops_valid) {
    ASSERT_EQ(count_errors("int main(void) { int x = 5 & 3; int y = 5 | 3; return 0; }"), 0);
}

TEST(ternary_expr_valid) {
    ASSERT_EQ(count_errors("int main(void) { int x = 1 ? 2 : 3; return x; }"), 0);
}

TEST(sizeof_expr) {
    ASSERT_EQ(count_errors("int main(void) { int x = sizeof(int); return 0; }"), 0);
}

TEST(postfix_increment) {
    ASSERT_EQ(count_errors("int main(void) { int x = 0; x++; return x; }"), 0);
}

TEST(address_of_array) {
    ASSERT_EQ(count_errors("int main(void) { int arr[5]; int *p = arr; return 0; }"), 0);
}

TEST(typedef_not_implemented) {
    /* typedef is parsed but not fully handled by semantic analyzer */
    ASSERT_EQ(count_errors("typedef int myint; myint x = 5;"), 0);
}

/* ======================================================================== */

int main(void) {
    printf("Running C semantic analyzer tests...\n\n");

    RUN(empty_program);
    RUN(simple_function);
    RUN(undeclared_variable);
    RUN(wrong_return_type);
    RUN(void_function_with_return_value);
    RUN(function_call_undeclared);
    RUN(scope_shadowing);
    RUN(pointer_dereference);
    RUN(invalid_dereference);
    RUN(type_mismatch_assignment);
    RUN(return_outside_function);
    RUN(pointer_arithmetic_valid);
    RUN(null_pointer_assignment);
    RUN(valid_var_decls);
    RUN(type_mismatch_init);
    RUN(duplicate_var_decl);
    RUN(valid_func_with_params);
    RUN(duplicate_func_decl);
    RUN(duplicate_param_names);
    RUN(valid_binary_exprs);
    RUN(invalid_pointer_arithmetic);
    RUN(valid_comparisons);
    RUN(valid_assignment);
    RUN(invalid_assignment_pointer_to_int);
    RUN(use_undeclared_top_level);
    RUN(valid_function_call);
    RUN(wrong_arg_count);
    RUN(wrong_arg_type);
    RUN(missing_return_value);
    RUN(valid_if_statement);
    RUN(valid_while_statement);
    RUN(valid_for_statement);
    RUN(global_scope_visibility);
    RUN(parameter_scope);
    RUN(factorial_program);
    RUN(empty_return_void);
    RUN(void_no_return);
    RUN(invalid_increment_pointer);
    RUN(bitwise_ops_valid);
    RUN(ternary_expr_valid);
    RUN(sizeof_expr);
    RUN(postfix_increment);
    RUN(address_of_array);
    RUN(typedef_not_implemented);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n",
           tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
