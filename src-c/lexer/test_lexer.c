#include "lexer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

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

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        printf("FAIL: expected %d, got %d\n", (b), (a)); \
        tests_failed++; \
        return; \
    } \
} while(0)

#define ASSERT_TOKEN_TYPE(toks, idx, expected_type) do { \
    if ((toks)[(idx)]->type != (expected_type)) { \
        printf("FAIL: token %d expected %s, got %s\n", (idx), \
               token_type_name(expected_type), token_type_name((toks)[(idx)]->type)); \
        tests_failed++; \
        return; \
    } \
} while(0)

#define ASSERT_TOKEN_VALUE(toks, idx, expected_val) do { \
    if (strcmp((toks)[(idx)]->value, (expected_val)) != 0) { \
        printf("FAIL: token %d expected '%s', got '%s'\n", (idx), \
               (expected_val), (toks)[(idx)]->value); \
        tests_failed++; \
        return; \
    } \
} while(0)

/* ======================================================================== */

TEST(empty) {
    Lexer l;
    lexer_init(&l, "");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_EQ(count, 1);
    ASSERT_TOKEN_TYPE(toks, 0, TT_EOF);
    tokens_free(toks, count);
}

TEST(simple_tokens) {
    Lexer l;
    lexer_init(&l, "int main(void) { return 42; }");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_INT);
    ASSERT_TOKEN_TYPE(toks, 1, TT_IDENTIFIER);
    ASSERT_TOKEN_VALUE(toks, 1, "main");
    ASSERT_TOKEN_TYPE(toks, 2, TT_LEFT_PAREN);
    ASSERT_TOKEN_TYPE(toks, 3, TT_VOID);
    ASSERT_TOKEN_TYPE(toks, 4, TT_RIGHT_PAREN);
    ASSERT_TOKEN_TYPE(toks, 5, TT_LEFT_BRACE);
    ASSERT_TOKEN_TYPE(toks, 6, TT_RETURN);
    ASSERT_TOKEN_TYPE(toks, 7, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 7, "42");
    ASSERT_TOKEN_TYPE(toks, 8, TT_SEMICOLON);
    ASSERT_TOKEN_TYPE(toks, 9, TT_RIGHT_BRACE);
    ASSERT_TOKEN_TYPE(toks, 10, TT_EOF);
    tokens_free(toks, count);
}

TEST(operators) {
    Lexer l;
    lexer_init(&l, "a + b - c * d / e % f == g != h <= i >= j && k || l << m >> n");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 1, TT_PLUS);
    ASSERT_TOKEN_TYPE(toks, 3, TT_MINUS);
    ASSERT_TOKEN_TYPE(toks, 5, TT_MULTIPLY);
    ASSERT_TOKEN_TYPE(toks, 7, TT_DIVIDE);
    ASSERT_TOKEN_TYPE(toks, 9, TT_MODULO);
    ASSERT_TOKEN_TYPE(toks, 11, TT_EQUAL);
    ASSERT_TOKEN_TYPE(toks, 13, TT_NOT_EQUAL);
    ASSERT_TOKEN_TYPE(toks, 15, TT_LESS_EQUAL);
    ASSERT_TOKEN_TYPE(toks, 17, TT_GREATER_EQUAL);
    ASSERT_TOKEN_TYPE(toks, 19, TT_AND);
    ASSERT_TOKEN_TYPE(toks, 21, TT_OR);
    ASSERT_TOKEN_TYPE(toks, 23, TT_LEFT_SHIFT);
    ASSERT_TOKEN_TYPE(toks, 25, TT_RIGHT_SHIFT);
    tokens_free(toks, count);
}

TEST(compound_assignment) {
    Lexer l;
    lexer_init(&l, "+= -= *= /= %= &= |= ^= <<= >>= ++ --");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_PLUS_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 1, TT_MINUS_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 2, TT_MULTIPLY_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 3, TT_DIVIDE_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 4, TT_MODULO_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 5, TT_AND_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 6, TT_OR_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 7, TT_XOR_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 8, TT_LEFT_SHIFT_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 9, TT_RIGHT_SHIFT_ASSIGN);
    ASSERT_TOKEN_TYPE(toks, 10, TT_INCREMENT);
    ASSERT_TOKEN_TYPE(toks, 11, TT_DECREMENT);
    tokens_free(toks, count);
}

TEST(string_literal) {
    Lexer l;
    lexer_init(&l, "\"hello world\"");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_STRING);
    ASSERT_TOKEN_VALUE(toks, 0, "\"hello world\"");
    tokens_free(toks, count);
}

TEST(char_literal) {
    Lexer l;
    lexer_init(&l, "'x' '\\n'");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_CHARACTER);
    ASSERT_TOKEN_VALUE(toks, 0, "'x'");
    ASSERT_TOKEN_TYPE(toks, 1, TT_CHARACTER);
    ASSERT_TOKEN_VALUE(toks, 1, "'\\n'");
    tokens_free(toks, count);
}

TEST(comments_ignored) {
    Lexer l;
    lexer_init(&l, "int x; // line comment\nint y; /* block */ int z;");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_INT);
    ASSERT_TOKEN_TYPE(toks, 1, TT_IDENTIFIER);
    ASSERT_TOKEN_VALUE(toks, 1, "x");
    ASSERT_TOKEN_TYPE(toks, 2, TT_SEMICOLON);
    ASSERT_TOKEN_TYPE(toks, 3, TT_INT);
    ASSERT_TOKEN_TYPE(toks, 4, TT_IDENTIFIER);
    ASSERT_TOKEN_VALUE(toks, 4, "y");
    ASSERT_TOKEN_TYPE(toks, 5, TT_SEMICOLON);
    ASSERT_TOKEN_TYPE(toks, 6, TT_INT);
    ASSERT_TOKEN_TYPE(toks, 7, TT_IDENTIFIER);
    ASSERT_TOKEN_VALUE(toks, 7, "z");
    ASSERT_TOKEN_TYPE(toks, 8, TT_SEMICOLON);
    tokens_free(toks, count);
}

TEST(preprocessor_directive) {
    Lexer l;
    lexer_init(&l, "#define MAX 100\nint x;");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_PREPROCESSOR);
    ASSERT_TOKEN_VALUE(toks, 0, "#define MAX 100");
    ASSERT_TOKEN_TYPE(toks, 1, TT_INT);
    tokens_free(toks, count);
}

TEST(numbers) {
    Lexer l;
    lexer_init(&l, "42 0xFF 0777 3.14 1e10 0xABC");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 0, "42");
    ASSERT_TOKEN_TYPE(toks, 1, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 1, "0xFF");
    ASSERT_TOKEN_TYPE(toks, 2, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 2, "0777");
    ASSERT_TOKEN_TYPE(toks, 3, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 3, "3.14");
    ASSERT_TOKEN_TYPE(toks, 4, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 4, "1e10");
    ASSERT_TOKEN_TYPE(toks, 5, TT_NUMBER);
    ASSERT_TOKEN_VALUE(toks, 5, "0xABC");
    tokens_free(toks, count);
}

TEST(keywords) {
    Lexer l;
    lexer_init(&l, "if else while for return struct sizeof static extern const inline typedef enum union break continue goto do switch case default");
    int count;
    Token **toks = lexer_tokenize(&l, &count);
    ASSERT_TOKEN_TYPE(toks, 0, TT_IF);
    ASSERT_TOKEN_TYPE(toks, 1, TT_ELSE);
    ASSERT_TOKEN_TYPE(toks, 2, TT_WHILE);
    ASSERT_TOKEN_TYPE(toks, 3, TT_FOR);
    ASSERT_TOKEN_TYPE(toks, 4, TT_RETURN);
    ASSERT_TOKEN_TYPE(toks, 5, TT_STRUCT);
    ASSERT_TOKEN_TYPE(toks, 6, TT_SIZEOF);
    ASSERT_TOKEN_TYPE(toks, 7, TT_STATIC);
    ASSERT_TOKEN_TYPE(toks, 8, TT_EXTERN);
    ASSERT_TOKEN_TYPE(toks, 9, TT_CONST);
    ASSERT_TOKEN_TYPE(toks, 10, TT_INLINE);
    ASSERT_TOKEN_TYPE(toks, 11, TT_TYPEDEF);
    ASSERT_TOKEN_TYPE(toks, 12, TT_ENUM);
    ASSERT_TOKEN_TYPE(toks, 13, TT_UNION);
    ASSERT_TOKEN_TYPE(toks, 14, TT_BREAK);
    ASSERT_TOKEN_TYPE(toks, 15, TT_CONTINUE);
    ASSERT_TOKEN_TYPE(toks, 16, TT_GOTO);
    ASSERT_TOKEN_TYPE(toks, 17, TT_DO);
    ASSERT_TOKEN_TYPE(toks, 18, TT_SWITCH);
    ASSERT_TOKEN_TYPE(toks, 19, TT_CASE);
    ASSERT_TOKEN_TYPE(toks, 20, TT_DEFAULT);
    tokens_free(toks, count);
}

/* ======================================================================== */

int main(void) {
    printf("Running C lexer tests...\n\n");

    RUN(empty);
    RUN(simple_tokens);
    RUN(operators);
    RUN(compound_assignment);
    RUN(string_literal);
    RUN(char_literal);
    RUN(comments_ignored);
    RUN(preprocessor_directive);
    RUN(numbers);
    RUN(keywords);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n",
           tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
