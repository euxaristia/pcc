#include "parser.h"
#include "../lexer/lexer.h"
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
    if (!current_test_failed) { \
        current_test_failed = 1; \
        tests_failed++; \
    } \
    printf("FAIL: %s\n", msg); \
    return; \
} while(0)

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        if (!current_test_failed) { \
            current_test_failed = 1; \
            tests_failed++; \
        } \
        printf("FAIL: expected %d, got %d\n", (b), (a)); \
        return; \
    } \
} while(0)

#define ASSERT_STR_EQ(a, b) do { \
    if (strcmp((a), (b)) != 0) { \
        if (!current_test_failed) { \
            current_test_failed = 1; \
            tests_failed++; \
        } \
        printf("FAIL: expected '%s', got '%s'\n", (b), (a)); \
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

/* ======================================================================== */

TEST(empty) {
    ASTNode *ast = parse_code("");
    ASSERT_EQ(ast->type, NT_PROGRAM);
    ASSERT_EQ(ast->u.program.ndecls, 0);
}

TEST(simple_function) {
    ASTNode *ast = parse_code("int main(void) { return 0; }");
    ASSERT_EQ(ast->type, NT_PROGRAM);
    ASSERT_EQ(ast->u.program.ndecls, 1);
    ASTNode *func = ast->u.program.decls[0];
    ASSERT_EQ(func->type, NT_FUNCTION_DECL);
    ASSERT_STR_EQ(func->u.func.name, "main");
    ASSERT_STR_EQ(func->u.func.ret_type->type_name, "int");
    ASSERT_EQ(func->u.func.nparam, 1);
    ASSERT_EQ(func->u.func.body->type, NT_COMPOUND_STMT);
    ASSERT_EQ(func->u.func.body->u.compound.nstmts, 1);
    ASSERT_EQ(func->u.func.body->u.compound.stmts[0]->type, NT_RETURN_STMT);
}

TEST(variable_declaration) {
    ASTNode *ast = parse_code("int x = 42;");
    ASSERT_EQ(ast->type, NT_PROGRAM);
    ASSERT_EQ(ast->u.program.ndecls, 1);
    ASTNode *decl = ast->u.program.decls[0];
    ASSERT_EQ(decl->type, NT_DECLARATION);
    ASSERT_STR_EQ(decl->u.decl.name, "x");
    ASSERT_STR_EQ(decl->u.decl.var_type->type_name, "int");
    ASSERT_EQ(decl->u.decl.init->type, NT_NUMBER_LIT);
    ASSERT_STR_EQ(decl->u.decl.init->u.number.value, "42");
}

TEST(binary_expression) {
    ASTNode *ast = parse_code("int x = 1 + 2 * 3;");
    ASSERT_EQ(ast->type, NT_PROGRAM);
    ASTNode *decl = ast->u.program.decls[0];
    ASSERT_EQ(decl->u.decl.init->type, NT_BINARY_EXPR);
    ASSERT_STR_EQ(decl->u.decl.init->u.binary.op, "+");
    ASSERT_EQ(decl->u.decl.init->u.binary.right->type, NT_BINARY_EXPR);
    ASSERT_STR_EQ(decl->u.decl.init->u.binary.right->u.binary.op, "*");
}

TEST(if_statement) {
    ASTNode *ast = parse_code("int main() { if (x) return 1; else return 0; }");
    ASSERT_EQ(ast->type, NT_PROGRAM);
    ASTNode *func = ast->u.program.decls[0];
    ASTNode *if_stmt = func->u.func.body->u.compound.stmts[0];
    ASSERT_EQ(if_stmt->type, NT_IF_STMT);
    ASSERT_EQ(if_stmt->u.if_stmt.cond->type, NT_IDENTIFIER);
    ASSERT_EQ(if_stmt->u.if_stmt.then_br->type, NT_RETURN_STMT);
    ASSERT_EQ(if_stmt->u.if_stmt.else_br->type, NT_RETURN_STMT);
}

TEST(while_loop) {
    ASTNode *ast = parse_code("int main() { while (x) { x = x - 1; } }");
    ASTNode *func = ast->u.program.decls[0];
    ASTNode *while_stmt = func->u.func.body->u.compound.stmts[0];
    ASSERT_EQ(while_stmt->type, NT_WHILE_STMT);
    ASSERT_EQ(while_stmt->u.loop.cond->type, NT_IDENTIFIER);
    ASSERT_EQ(while_stmt->u.loop.body->type, NT_COMPOUND_STMT);
}

TEST(for_loop) {
    ASTNode *ast = parse_code("int main() { for (i = 0; i < 10; i = i + 1) { } }");
    ASTNode *func = ast->u.program.decls[0];
    ASTNode *for_stmt = func->u.func.body->u.compound.stmts[0];
    ASSERT_EQ(for_stmt->type, NT_FOR_STMT);
    ASSERT_EQ(for_stmt->u.for_stmt.init->type, NT_ASSIGNMENT);
    ASSERT_EQ(for_stmt->u.for_stmt.cond->type, NT_BINARY_EXPR);
    ASSERT_EQ(for_stmt->u.for_stmt.incr->type, NT_ASSIGNMENT);
}

TEST(function_call) {
    ASTNode *ast = parse_code("int main() { foo(1, 2); }");
    ASTNode *func = ast->u.program.decls[0];
    ASTNode *expr_stmt = func->u.func.body->u.compound.stmts[0];
    ASSERT_EQ(expr_stmt->type, NT_EXPR_STMT);
    ASSERT_EQ(expr_stmt->u.expr_stmt.expr->type, NT_FUNCTION_CALL);
    ASSERT_EQ(expr_stmt->u.expr_stmt.expr->u.call.nargs, 2);
}

TEST(unary_expression) {
    ASTNode *ast = parse_code("int x = -42;");
    ASTNode *decl = ast->u.program.decls[0];
    ASSERT_EQ(decl->u.decl.init->type, NT_UNARY_EXPR);
    ASSERT_STR_EQ(decl->u.decl.init->u.unary.op, "-");
}

TEST(ternary_expression) {
    ASTNode *ast = parse_code("int x = a ? 1 : 2;");
    ASTNode *decl = ast->u.program.decls[0];
    ASTNode *ternary = decl->u.decl.init;
    ASSERT_EQ(ternary->type, NT_TERNARY_EXPR);
    ASSERT_EQ(ternary->u.ternary.cond->type, NT_IDENTIFIER);
    ASSERT_EQ(ternary->u.ternary.then_expr->type, NT_NUMBER_LIT);
    ASSERT_EQ(ternary->u.ternary.else_expr->type, NT_NUMBER_LIT);
}

TEST(sizeof_expression) {
    ASTNode *ast = parse_code("int x = sizeof(int);");
    ASTNode *decl = ast->u.program.decls[0];
    ASSERT_EQ(decl->u.decl.init->type, NT_SIZEOF_EXPR);
    ASSERT_EQ(decl->u.decl.init->u.szexpr.is_type, 1);
}

TEST(multi_declaration) {
    ASTNode *ast = parse_code("int x, y, z;");
    ASSERT_EQ(ast->u.program.ndecls, 1);
    ASTNode *multi = ast->u.program.decls[0];
    ASSERT_EQ(multi->type, NT_MULTI_DECLARATION);
    ASSERT_EQ(multi->u.multi.ndecls, 3);
}

/* ======================================================================== */

int main(void) {
    printf("Running C parser tests...\n\n");

    RUN(empty);
    RUN(simple_function);
    RUN(variable_declaration);
    RUN(binary_expression);
    RUN(if_statement);
    RUN(while_loop);
    RUN(for_loop);
    RUN(function_call);
    RUN(unary_expression);
    RUN(ternary_expression);
    RUN(sizeof_expression);
    RUN(multi_declaration);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n",
           tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
