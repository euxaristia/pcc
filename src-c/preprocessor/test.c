#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "pp.h"

static int tests_run = 0;
static int tests_passed = 0;
static int tests_failed = 0;

#define TEST(name) static void test_##name(void)
#define RUN(name) do { \
    tests_run++; \
    printf("  test_" #name " ... "); \
    fflush(stdout); \
    test_##name(); \
    tests_passed++; \
    printf("PASS\n"); \
} while(0)

#define FAIL(msg) do { \
    tests_failed++; \
    printf("FAIL: %s\n", msg); \
    return; \
} while(0)

#define ASSERT_STR_EQ(a, b) do { \
    if (strcmp((a), (b)) != 0) { \
        printf("FAIL: expected:\n%s\ngot:\n%s\n", (b), (a)); \
        tests_failed++; \
        return; \
    } \
} while(0)

#define ASSERT_CONTAINS(haystack, needle) do { \
    if (strstr((haystack), (needle)) == NULL) { \
        printf("FAIL: expected to contain '%s' but got:\n%s\n", (needle), (haystack)); \
        tests_failed++; \
        return; \
    } \
} while(0)

#define ASSERT_NOT_CONTAINS(haystack, needle) do { \
    if (strstr((haystack), (needle)) != NULL) { \
        printf("FAIL: expected NOT to contain '%s' but got:\n%s\n", (needle), (haystack)); \
        tests_failed++; \
        return; \
    } \
} while(0)

// ============================================================================
// Basic tokenization and passthrough
// ============================================================================

TEST(empty) {
    char *out = preprocess("", "test.c", NULL, 0, NULL, 0);
    ASSERT_STR_EQ(out, "");
    pp_result_free(out);
}

TEST(simple_int) {
    char *out = preprocess("int main() { return 42; }", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int");
    ASSERT_CONTAINS(out, "main");
    ASSERT_CONTAINS(out, "return");
    ASSERT_CONTAINS(out, "42");
    pp_result_free(out);
}

TEST(preserves_newlines) {
    char *out = preprocess("int a;\nint b;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int a;");
    ASSERT_CONTAINS(out, "int b;");
    pp_result_free(out);
}

TEST(ignores_comments) {
    char *out = preprocess("int a; /* comment */ int b;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "comment");
    pp_result_free(out);
}

TEST(ignores_cpp_comments) {
    char *out = preprocess("int a; // comment\nint b;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "comment");
    pp_result_free(out);
}

TEST(string_literal) {
    char *out = preprocess("const char *s = \"hello\";", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "\"hello\"");
    pp_result_free(out);
}

TEST(char_literal) {
    char *out = preprocess("char c = 'a';", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "'a'");
    pp_result_free(out);
}

// ============================================================================
// #define - object-like macros
// ============================================================================

TEST(define_simple) {
    char *out = preprocess("#define FOO 42\nint x = FOO;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "42");
    ASSERT_NOT_CONTAINS(out, "FOO");
    pp_result_free(out);
}

TEST(define_expression) {
    char *out = preprocess("#define ADD a + b\nint x = ADD;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "a+b");
    pp_result_free(out);
}

TEST(define_multiple_uses) {
    char *out = preprocess("#define FOO 1\nint a = FOO; int b = FOO;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int a=1;");
    ASSERT_CONTAINS(out, "int b=1;");
    pp_result_free(out);
}

TEST(define_not_expanded_in_define) {
    // Macro body should not expand during definition
    char *out = preprocess("#define FOO 1\n#define BAR FOO\nint x = BAR;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

// ============================================================================
// #define - function-like macros
// ============================================================================

TEST(define_function_like) {
    char *out = preprocess("#define ADD(a,b) a + b\nint x = ADD(1,2);", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "1+2");
    ASSERT_NOT_CONTAINS(out, "ADD");
    pp_result_free(out);
}

TEST(define_function_like_nested) {
    char *out = preprocess("#define MAX(a,b) ((a) > (b) ? (a) : (b))\nint x = MAX(3,5);", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "((3)>(5)?(3):(5))");
    pp_result_free(out);
}

TEST(define_va_args) {
    char *out = preprocess("#define LOG(fmt, ...) printf(fmt, __VA_ARGS__)\nLOG(\"%d\", 42);", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "printf(\"%d\",42)");
    pp_result_free(out);
}

// ============================================================================
// #undef
// ============================================================================

TEST(undef_removes_macro) {
    char *out = preprocess("#define FOO 1\n#undef FOO\nint x = FOO;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "FOO"); // should NOT be expanded after undef
    pp_result_free(out);
}

// ============================================================================
// #ifdef / #ifndef / #endif
// ============================================================================

TEST(ifdef_defined) {
    char *out = preprocess("#define FOO\n#ifdef FOO\nint x = 1;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

TEST(ifdef_undefined) {
    char *out = preprocess("#ifdef FOO\nint x = 1;\n#endif\nint y = 2;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int x = 1");
    ASSERT_CONTAINS(out, "int y=2;");
    pp_result_free(out);
}

TEST(ifndef_defined) {
    char *out = preprocess("#define FOO\n#ifndef FOO\nint x = 1;\n#endif\nint y = 2;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int x = 1");
    ASSERT_CONTAINS(out, "int y=2;");
    pp_result_free(out);
}

TEST(ifndef_undefined) {
    char *out = preprocess("#ifndef FOO\nint x = 1;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

TEST(nested_ifdef) {
    char *out = preprocess(
        "#define A\n"
        "#define B\n"
        "#ifdef A\n"
        "#ifdef B\n"
        "int x = 1;\n"
        "#endif\n"
        "#endif",
        "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

// ============================================================================
// #if / #elif / #else / #endif
// ============================================================================

TEST(if_true) {
    char *out = preprocess("#if 1\nint x = 1;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

TEST(if_false) {
    char *out = preprocess("#if 0\nint x = 1;\n#endif\nint y = 2;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int x = 1");
    ASSERT_CONTAINS(out, "int y=2;");
    pp_result_free(out);
}

TEST(if_else) {
    char *out = preprocess("#if 0\nint x = 1;\n#else\nint x = 2;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int x = 1");
    ASSERT_CONTAINS(out, "int x=2;");
    pp_result_free(out);
}

TEST(elif) {
    char *out = preprocess("#if 0\nint a = 1;\n#elif 1\nint b = 2;\n#else\nint c = 3;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int a = 1");
    ASSERT_CONTAINS(out, "int b=2;");
    ASSERT_NOT_CONTAINS(out, "int c = 3");
    pp_result_free(out);
}

TEST(if_defined) {
    char *out = preprocess("#define FOO\n#if defined(FOO)\nint x = 1;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

TEST(if_arithmetic) {
    char *out = preprocess("#if 2 + 2 == 4\nint x = 1;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

TEST(if_arithmetic_false) {
    char *out = preprocess("#if 2 + 2 == 5\nint x = 1;\n#endif\nint y = 2;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int x = 1");
    ASSERT_CONTAINS(out, "int y=2;");
    pp_result_free(out);
}

// ============================================================================
// Built-in macros
// ============================================================================

TEST(builtin_stdc) {
    char *out = preprocess("int x = __STDC__;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "1");
    pp_result_free(out);
}

TEST(builtin_gnuc) {
    char *out = preprocess("int x = __GNUC__;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "11");
    pp_result_free(out);
}

// ============================================================================
// -D flag macros
// ============================================================================

TEST(define_from_cli) {
    const char *defs[] = {"DEBUG"};
    char *out = preprocess("int x = DEBUG;", "test.c", NULL, 0, defs, 1);
    ASSERT_CONTAINS(out, "1");
    pp_result_free(out);
}

TEST(define_value_from_cli) {
    const char *defs[] = {"FOO=42"};
    char *out = preprocess("int x = FOO;", "test.c", NULL, 0, defs, 1);
    ASSERT_CONTAINS(out, "42");
    pp_result_free(out);
}

// ============================================================================
// Comment removal
// ============================================================================

TEST(block_comment_removed) {
    char *out = preprocess("int /* removed */ x;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "removed");
    ASSERT_CONTAINS(out, "int");
    ASSERT_CONTAINS(out, "x;");
    pp_result_free(out);
}

TEST(line_comment_removed) {
    char *out = preprocess("int x; // removed\nint y;", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "removed");
    ASSERT_CONTAINS(out, "int y;");
    pp_result_free(out);
}

// ============================================================================
// Line continuation
// ============================================================================

TEST(line_continuation) {
    /* Line continuation joins lines: #define FOO \
       1
       becomes #define FOO 1 */
    char *out = preprocess("#define FOO \\\n1\nint x = FOO;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=1;");
    pp_result_free(out);
}

// ============================================================================
// Stringification
// ============================================================================

TEST(stringify) {
    char *out = preprocess("#define STR(x) #x\nconst char *s = STR(hello);", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "\"hello\"");
    pp_result_free(out);
}

// ============================================================================
// Edge cases
// ============================================================================

TEST(macro_not_identifier) {
    // FOO123 should not match FOO
    char *out = preprocess("#define FOO 1\nint x = FOO123;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "FOO123");
    pp_result_free(out);
}

TEST(empty_define) {
    char *out = preprocess("#define FOO\nint x = FOO;", "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "int x=;");
    pp_result_free(out);
}

TEST(multiple_defines) {
    char *out = preprocess(
        "#define A 1\n"
        "#define B 2\n"
        "#define ADD(a,b) a + b\n"
        "int x = ADD(A,B);",
        "test.c", NULL, 0, NULL, 0);
    ASSERT_CONTAINS(out, "1+2");
    pp_result_free(out);
}

TEST(if_with_and_or) {
    char *out = preprocess("#if 1 && 0\nint a = 1;\n#elif 1 || 0\nint b = 2;\n#endif", "test.c", NULL, 0, NULL, 0);
    ASSERT_NOT_CONTAINS(out, "int a = 1");
    ASSERT_CONTAINS(out, "int b=2;");
    pp_result_free(out);
}

// ============================================================================
// Main
// ============================================================================

int main(void) {
    printf("Running C preprocessor tests...\n\n");

    // Basic
    RUN(empty);
    RUN(simple_int);
    RUN(preserves_newlines);
    RUN(ignores_comments);
    RUN(ignores_cpp_comments);
    RUN(string_literal);
    RUN(char_literal);

    // Object-like macros
    RUN(define_simple);
    RUN(define_expression);
    RUN(define_multiple_uses);
    RUN(define_not_expanded_in_define);

    // Function-like macros
    RUN(define_function_like);
    RUN(define_function_like_nested);
    RUN(define_va_args);

    // Undef
    RUN(undef_removes_macro);

    // Ifdef
    RUN(ifdef_defined);
    RUN(ifdef_undefined);
    RUN(ifndef_defined);
    RUN(ifndef_undefined);
    RUN(nested_ifdef);

    // If/elif/else
    RUN(if_true);
    RUN(if_false);
    RUN(if_else);
    RUN(elif);
    RUN(if_defined);
    RUN(if_arithmetic);
    RUN(if_arithmetic_false);

    // Built-ins
    RUN(builtin_stdc);
    RUN(builtin_gnuc);

    // CLI defines
    RUN(define_from_cli);
    RUN(define_value_from_cli);

    // Comments
    RUN(block_comment_removed);
    RUN(line_comment_removed);

    // Line continuation
    RUN(line_continuation);

    // Stringification
    RUN(stringify);

    // Edge cases
    RUN(macro_not_identifier);
    RUN(empty_define);
    RUN(multiple_defines);
    RUN(if_with_and_or);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n",
           tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
