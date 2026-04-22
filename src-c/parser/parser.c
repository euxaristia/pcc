#include "parser.h"
#include "../preprocessor/arena.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

/* ========================================================================
   Memory helpers
   ======================================================================== */

static Arena *g_arena = NULL;

static void *palloc(size_t n) {
    if (!g_arena) g_arena = arena_create(65536);
    return arena_alloc(g_arena, n);
}

static char *pstrdup(const char *s) {
    if (!s) return NULL;
    size_t n = strlen(s) + 1;
    char *d = palloc(n);
    memcpy(d, s, n);
    return d;
}

/* ========================================================================
   Parser infrastructure
   ======================================================================== */

void parser_init(Parser *p, Token **tokens, int count) {
    p->tokens = tokens;
    p->count  = count;
    p->pos    = 0;
}

static Token *current(Parser *p) {
    if (p->pos < p->count) return p->tokens[p->pos];
    return p->tokens[p->count - 1]; /* EOF */
}

static Token *peek(Parser *p, int offset) {
    int i = p->pos + offset;
    if (i < p->count) return p->tokens[i];
    return p->tokens[p->count - 1];
}

static Token *advance(Parser *p) {
    Token *t = current(p);
    if (p->pos < p->count - 1) p->pos++;
    return t;
}

static int match(Parser *p, TokenType type) {
    if (current(p)->type == type) {
        advance(p);
        return 1;
    }
    return 0;
}

static Token *consume(Parser *p, TokenType type, const char *msg) {
    if (current(p)->type == type) return advance(p);
    fprintf(stderr, "Parse error at line %d: %s (got %s '%s')\n",
            current(p)->line, msg, token_type_name(current(p)->type), current(p)->value);
    return NULL;
}

/* ========================================================================
   AST constructors
   ======================================================================== */

static ASTNode *make_node(NodeType type, int line, int col) {
    ASTNode *n = palloc(sizeof(ASTNode));
    memset(n, 0, sizeof(ASTNode));
    n->type   = type;
    n->line   = line;
    n->column = col;
    return n;
}

static TypeSpec *make_typespec(const char *name) {
    TypeSpec *t = palloc(sizeof(TypeSpec));
    memset(t, 0, sizeof(TypeSpec));
    t->type_name = pstrdup(name);
    return t;
}

/* ========================================================================
   Forward declarations
   ======================================================================== */

static ASTNode *parse_expression(Parser *p);
static ASTNode *parse_assignment(Parser *p);
static ASTNode *parse_statement(Parser *p);
static ASTNode *parse_declaration(Parser *p);
static TypeSpec *parse_type_specifier(Parser *p);
static ASTNode *parse_compound_statement(Parser *p);
static ASTNode *parse_if_statement(Parser *p);
static ASTNode *parse_while_statement(Parser *p);
static ASTNode *parse_for_statement(Parser *p);
static ASTNode *parse_do_while_statement(Parser *p);
static ASTNode *parse_return_statement(Parser *p);
static ASTNode *parse_switch_statement(Parser *p);

/* ========================================================================
   Expression parsing (recursive descent)
   ======================================================================== */

static ASTNode *parse_primary(Parser *p) {
    Token *t = current(p);
    if (match(p, TT_NUMBER)) {
        ASTNode *n = make_node(NT_NUMBER_LIT, t->line, t->column);
        n->u.number.value = pstrdup(t->value);
        return n;
    }
    if (match(p, TT_STRING)) {
        ASTNode *n = make_node(NT_STRING_LIT, t->line, t->column);
        n->u.str_lit.value = pstrdup(t->value);
        return n;
    }
    if (match(p, TT_CHARACTER)) {
        ASTNode *n = make_node(NT_CHAR_LIT, t->line, t->column);
        n->u.str_lit.value = pstrdup(t->value);
        return n;
    }
    if (match(p, TT_IDENTIFIER)) {
        ASTNode *n = make_node(NT_IDENTIFIER, t->line, t->column);
        n->u.ident.name = pstrdup(t->value);
        return n;
    }
    if (match(p, TT_LEFT_PAREN)) {
        ASTNode *expr = parse_expression(p);
        consume(p, TT_RIGHT_PAREN, "Expected ')' after expression");
        return expr;
    }
    fprintf(stderr, "Unexpected token %s '%s' at line %d\n",
            token_type_name(t->type), t->value, t->line);
    return NULL;
}

static ASTNode *parse_postfix(Parser *p) {
    ASTNode *expr = parse_primary(p);
    if (!expr) return NULL;

    while (1) {
        Token *t = current(p);
        if (match(p, TT_LEFT_PAREN)) {
            /* function call */
            ASTNode *call = make_node(NT_FUNCTION_CALL, t->line, t->column);
            call->u.call.callee = expr;
            int cap = 8, nargs = 0;
            ASTNode **args = palloc(sizeof(ASTNode*) * cap);
            while (!match(p, TT_RIGHT_PAREN)) {
                if (nargs > 0) consume(p, TT_COMMA, "Expected ',' between arguments");
                /* use parse_assignment, not parse_expression, so commas separate args */
                ASTNode *arg = parse_assignment(p);
                if (!arg) break;
                if (nargs >= cap) {
                    cap *= 2;
                    ASTNode **na = palloc(sizeof(ASTNode*) * cap);
                    memcpy(na, args, sizeof(ASTNode*) * nargs);
                    args = na;
                }
                args[nargs++] = arg;
            }
            call->u.call.args = args;
            call->u.call.nargs = nargs;
            expr = call;
        } else if (match(p, TT_LEFT_BRACKET)) {
            /* array access */
            ASTNode *idx = parse_expression(p);
            consume(p, TT_RIGHT_BRACKET, "Expected ']' after index");
            ASTNode *arr = make_node(NT_ARRAY_ACCESS, t->line, t->column);
            arr->u.arr.array = expr;
            arr->u.arr.index = idx;
            expr = arr;
        } else if (match(p, TT_DOT)) {
            Token *mem = consume(p, TT_IDENTIFIER, "Expected member name after '.'");
            ASTNode *m = make_node(NT_MEMBER_ACCESS, t->line, t->column);
            m->u.member.object = expr;
            m->u.member.member = pstrdup(mem->value);
            m->u.member.arrow = 0;
            expr = m;
        } else if (match(p, TT_ARROW)) {
            Token *mem = consume(p, TT_IDENTIFIER, "Expected member name after '->'");
            ASTNode *m = make_node(NT_MEMBER_ACCESS, t->line, t->column);
            m->u.member.object = expr;
            m->u.member.member = pstrdup(mem->value);
            m->u.member.arrow = 1;
            expr = m;
        } else if (match(p, TT_INCREMENT) || match(p, TT_DECREMENT)) {
            ASTNode *post = make_node(NT_POSTFIX_EXPR, t->line, t->column);
            post->u.postfix.op = pstrdup(t->value);
            post->u.postfix.operand = expr;
            expr = post;
        } else {
            break;
        }
    }
    return expr;
}

static ASTNode *parse_unary(Parser *p) {
    Token *t = current(p);
    if (match(p, TT_MINUS) || match(p, TT_NOT) || match(p, TT_TILDE) ||
        match(p, TT_PLUS) || match(p, TT_MULTIPLY) || match(p, TT_BITWISE_AND)) {
        ASTNode *n = make_node(NT_UNARY_EXPR, t->line, t->column);
        n->u.unary.op = pstrdup(t->value);
        n->u.unary.operand = parse_unary(p);
        return n;
    }
    if (match(p, TT_SIZEOF)) {
        ASTNode *n = make_node(NT_SIZEOF_EXPR, t->line, t->column);
        if (match(p, TT_LEFT_PAREN)) {
            /* sizeof(type) or sizeof(expr) */
            Token *lookahead = current(p);
            /* crude heuristic: if it looks like a type, parse as type */
            if (lookahead->type == TT_INT || lookahead->type == TT_CHAR ||
                lookahead->type == TT_VOID || lookahead->type == TT_LONG ||
                lookahead->type == TT_STRUCT || lookahead->type == TT_UNION ||
                lookahead->type == TT_IDENTIFIER) {
                /* try to parse as type */
                int saved = p->pos;
                TypeSpec *ts = parse_type_specifier(p);
                if (ts && current(p)->type == TT_RIGHT_PAREN) {
                    n->u.szexpr.is_type = 1;
                    n->u.szexpr.type = ts;
                    advance(p); /* consume ) */
                    return n;
                }
                /* backtrack */
                p->pos = saved;
            }
            n->u.szexpr.operand = parse_expression(p);
            consume(p, TT_RIGHT_PAREN, "Expected ')' after sizeof");
        } else {
            n->u.szexpr.operand = parse_unary(p);
        }
        return n;
    }
    return parse_postfix(p);
}

static ASTNode *parse_multiplicative(Parser *p) {
    ASTNode *left = parse_unary(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_MULTIPLY) || match(p, TT_DIVIDE) || match(p, TT_MODULO)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_unary(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_additive(Parser *p) {
    ASTNode *left = parse_multiplicative(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_PLUS) || match(p, TT_MINUS)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_multiplicative(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_shift(Parser *p) {
    ASTNode *left = parse_additive(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_LEFT_SHIFT) || match(p, TT_RIGHT_SHIFT)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_additive(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_relational(Parser *p) {
    ASTNode *left = parse_shift(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_LESS_THAN) || match(p, TT_GREATER_THAN) ||
            match(p, TT_LESS_EQUAL) || match(p, TT_GREATER_EQUAL)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_shift(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_equality(Parser *p) {
    ASTNode *left = parse_relational(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_EQUAL) || match(p, TT_NOT_EQUAL)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_relational(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_bitwise_and(Parser *p) {
    ASTNode *left = parse_equality(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_BITWISE_AND)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_equality(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_bitwise_xor(Parser *p) {
    ASTNode *left = parse_bitwise_and(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_BITWISE_XOR)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_bitwise_and(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_bitwise_or(Parser *p) {
    ASTNode *left = parse_bitwise_xor(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_BITWISE_OR)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_bitwise_xor(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_logical_and(Parser *p) {
    ASTNode *left = parse_bitwise_or(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_AND)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_bitwise_or(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_logical_or(Parser *p) {
    ASTNode *left = parse_logical_and(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_OR)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(t->value);
            n->u.binary.left = left;
            n->u.binary.right = parse_logical_and(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_ternary(Parser *p) {
    ASTNode *cond = parse_logical_or(p);
    if (match(p, TT_QUESTION)) {
        Token *t = current(p);
        ASTNode *then_expr = parse_expression(p);
        consume(p, TT_COLON, "Expected ':' in ternary expression");
        ASTNode *else_expr = parse_ternary(p);
        ASTNode *n = make_node(NT_TERNARY_EXPR, t->line, t->column);
        n->u.ternary.cond = cond;
        n->u.ternary.then_expr = then_expr;
        n->u.ternary.else_expr = else_expr;
        return n;
    }
    return cond;
}

static ASTNode *parse_assignment(Parser *p) {
    ASTNode *left = parse_ternary(p);
    Token *t = current(p);
    if (match(p, TT_ASSIGN) || match(p, TT_PLUS_ASSIGN) || match(p, TT_MINUS_ASSIGN) ||
        match(p, TT_MULTIPLY_ASSIGN) || match(p, TT_DIVIDE_ASSIGN) || match(p, TT_MODULO_ASSIGN) ||
        match(p, TT_AND_ASSIGN) || match(p, TT_OR_ASSIGN) || match(p, TT_XOR_ASSIGN) ||
        match(p, TT_LEFT_SHIFT_ASSIGN) || match(p, TT_RIGHT_SHIFT_ASSIGN)) {
        ASTNode *n = make_node(NT_ASSIGNMENT, t->line, t->column);
        n->u.assign.target = left;
        n->u.assign.op = pstrdup(t->value);
        n->u.assign.value = parse_assignment(p);
        return n;
    }
    return left;
}

static ASTNode *parse_comma(Parser *p) {
    ASTNode *left = parse_assignment(p);
    while (1) {
        Token *t = current(p);
        if (match(p, TT_COMMA)) {
            ASTNode *n = make_node(NT_BINARY_EXPR, t->line, t->column);
            n->u.binary.op = pstrdup(",");
            n->u.binary.left = left;
            n->u.binary.right = parse_assignment(p);
            left = n;
        } else break;
    }
    return left;
}

static ASTNode *parse_expression(Parser *p) {
    return parse_comma(p);
}

/* ========================================================================
   Statement parsing
   ======================================================================== */

static ASTNode *parse_compound_statement(Parser *p);

static ASTNode *parse_statement(Parser *p) {
    Token *t = current(p);

    if (match(p, TT_LEFT_BRACE))
        return parse_compound_statement(p);

    if (match(p, TT_IF))
        return parse_if_statement(p);

    if (match(p, TT_WHILE))
        return parse_while_statement(p);

    if (match(p, TT_FOR))
        return parse_for_statement(p);

    if (match(p, TT_DO))
        return parse_do_while_statement(p);

    if (match(p, TT_RETURN))
        return parse_return_statement(p);

    if (match(p, TT_BREAK)) {
        consume(p, TT_SEMICOLON, "Expected ';' after break");
        return make_node(NT_BREAK_STMT, t->line, t->column);
    }

    if (match(p, TT_CONTINUE)) {
        consume(p, TT_SEMICOLON, "Expected ';' after continue");
        return make_node(NT_CONTINUE_STMT, t->line, t->column);
    }

    if (match(p, TT_GOTO)) {
        Token *label = consume(p, TT_IDENTIFIER, "Expected label after goto");
        consume(p, TT_SEMICOLON, "Expected ';' after goto");
        ASTNode *n = make_node(NT_GOTO_STMT, t->line, t->column);
        n->u.label.label = pstrdup(label->value);
        return n;
    }

    if (match(p, TT_SWITCH))
        return parse_switch_statement(p);

    if (t->type == TT_IDENTIFIER && peek(p, 1)->type == TT_COLON) {
        /* label: statement */
        advance(p);
        advance(p);
        ASTNode *n = make_node(NT_LABEL_STMT, t->line, t->column);
        n->u.label.label = pstrdup(t->value);
        return n;
    }

    if (match(p, TT_ASM) || match(p, TT_VOLATILE)) {
        /* simplified asm statement */
        consume(p, TT_LEFT_PAREN, "Expected '(' after asm");
        Token *asm_str = consume(p, TT_STRING, "Expected assembly string");
        consume(p, TT_RIGHT_PAREN, "Expected ')' after asm");
        consume(p, TT_SEMICOLON, "Expected ';' after asm statement");
        ASTNode *n = make_node(NT_ASM_STMT, t->line, t->column);
        n->u.asm_stmt.assembly = pstrdup(asm_str->value);
        return n;
    }

    if (match(p, TT_SEMICOLON))
        return make_node(NT_EMPTY_STMT, t->line, t->column);

    /* expression statement */
    ASTNode *expr = parse_expression(p);
    consume(p, TT_SEMICOLON, "Expected ';' after expression");
    ASTNode *n = make_node(NT_EXPR_STMT, t->line, t->column);
    n->u.expr_stmt.expr = expr;
    return n;
}

static ASTNode *parse_compound_statement(Parser *p) {
    Token *t = current(p);
    /* we already consumed '{' */
    int cap = 16, nstmts = 0;
    ASTNode **stmts = palloc(sizeof(ASTNode*) * cap);
    while (!match(p, TT_RIGHT_BRACE)) {
        if (current(p)->type == TT_EOF) break;
        ASTNode *stmt = parse_statement(p);
        if (!stmt) break;
        if (nstmts >= cap) {
            cap *= 2;
            ASTNode **na = palloc(sizeof(ASTNode*) * cap);
            memcpy(na, stmts, sizeof(ASTNode*) * nstmts);
            stmts = na;
        }
        stmts[nstmts++] = stmt;
    }
    ASTNode *n = make_node(NT_COMPOUND_STMT, t->line, t->column);
    n->u.compound.stmts = stmts;
    n->u.compound.nstmts = nstmts;
    return n;
}

static ASTNode *parse_if_statement(Parser *p) {
    Token *t = current(p);
    consume(p, TT_LEFT_PAREN, "Expected '(' after if");
    ASTNode *cond = parse_expression(p);
    consume(p, TT_RIGHT_PAREN, "Expected ')' after if condition");
    ASTNode *then_br = parse_statement(p);
    ASTNode *else_br = NULL;
    if (match(p, TT_ELSE))
        else_br = parse_statement(p);
    ASTNode *n = make_node(NT_IF_STMT, t->line, t->column);
    n->u.if_stmt.cond = cond;
    n->u.if_stmt.then_br = then_br;
    n->u.if_stmt.else_br = else_br;
    return n;
}

static ASTNode *parse_while_statement(Parser *p) {
    Token *t = current(p);
    consume(p, TT_LEFT_PAREN, "Expected '(' after while");
    ASTNode *cond = parse_expression(p);
    consume(p, TT_RIGHT_PAREN, "Expected ')' after while condition");
    ASTNode *body = parse_statement(p);
    ASTNode *n = make_node(NT_WHILE_STMT, t->line, t->column);
    n->u.loop.cond = cond;
    n->u.loop.body = body;
    return n;
}

static ASTNode *parse_for_statement(Parser *p) {
    Token *t = current(p);
    consume(p, TT_LEFT_PAREN, "Expected '(' after for");
    ASTNode *init = NULL;
    if (!match(p, TT_SEMICOLON)) {
        init = parse_expression(p);
        consume(p, TT_SEMICOLON, "Expected ';' after for init");
    }
    ASTNode *cond = NULL;
    if (!match(p, TT_SEMICOLON)) {
        cond = parse_expression(p);
        consume(p, TT_SEMICOLON, "Expected ';' after for condition");
    }
    ASTNode *incr = NULL;
    if (!match(p, TT_RIGHT_PAREN)) {
        incr = parse_expression(p);
        consume(p, TT_RIGHT_PAREN, "Expected ')' after for increment");
    }
    ASTNode *body = parse_statement(p);
    ASTNode *n = make_node(NT_FOR_STMT, t->line, t->column);
    n->u.for_stmt.init = init;
    n->u.for_stmt.cond = cond;
    n->u.for_stmt.incr = incr;
    n->u.for_stmt.body = body;
    return n;
}

static ASTNode *parse_do_while_statement(Parser *p) {
    Token *t = current(p);
    ASTNode *body = parse_statement(p);
    consume(p, TT_WHILE, "Expected 'while' after do body");
    consume(p, TT_LEFT_PAREN, "Expected '(' after while");
    ASTNode *cond = parse_expression(p);
    consume(p, TT_RIGHT_PAREN, "Expected ')' after do-while condition");
    consume(p, TT_SEMICOLON, "Expected ';' after do-while");
    ASTNode *n = make_node(NT_DO_WHILE_STMT, t->line, t->column);
    n->u.loop.cond = cond;
    n->u.loop.body = body;
    return n;
}

static ASTNode *parse_return_statement(Parser *p) {
    Token *t = current(p);
    ASTNode *val = NULL;
    if (!match(p, TT_SEMICOLON))
        val = parse_expression(p);
    consume(p, TT_SEMICOLON, "Expected ';' after return");
    ASTNode *n = make_node(NT_RETURN_STMT, t->line, t->column);
    n->u.ret.value = val;
    return n;
}

static ASTNode *parse_switch_statement(Parser *p) {
    Token *t = current(p);
    consume(p, TT_LEFT_PAREN, "Expected '(' after switch");
    ASTNode *expr = parse_expression(p);
    consume(p, TT_RIGHT_PAREN, "Expected ')' after switch expression");
    consume(p, TT_LEFT_BRACE, "Expected '{' after switch");
    int cap = 8, ncases = 0;
    ASTNode **cases = palloc(sizeof(ASTNode*) * cap);
    while (!match(p, TT_RIGHT_BRACE)) {
        if (current(p)->type == TT_EOF) break;
        Token *ct = current(p);
        if (match(p, TT_CASE)) {
            ASTNode *case_n = make_node(NT_CASE_STMT, ct->line, ct->column);
            case_n->u.case_stmt.value = parse_expression(p);
            consume(p, TT_COLON, "Expected ':' after case value");
            int stmt_cap = 8, nstmts = 0;
            ASTNode **stmts = palloc(sizeof(ASTNode*) * stmt_cap);
            while (current(p)->type != TT_CASE && current(p)->type != TT_DEFAULT &&
                   current(p)->type != TT_RIGHT_BRACE && current(p)->type != TT_EOF) {
                ASTNode *stmt = parse_statement(p);
                if (!stmt) break;
                if (nstmts >= stmt_cap) {
                    stmt_cap *= 2;
                    ASTNode **na = palloc(sizeof(ASTNode*) * stmt_cap);
                    memcpy(na, stmts, sizeof(ASTNode*) * nstmts);
                    stmts = na;
                }
                stmts[nstmts++] = stmt;
            }
            case_n->u.case_stmt.stmts = stmts;
            case_n->u.case_stmt.nstmts = nstmts;
            if (ncases >= cap) {
                cap *= 2;
                ASTNode **na = palloc(sizeof(ASTNode*) * cap);
                memcpy(na, cases, sizeof(ASTNode*) * ncases);
                cases = na;
            }
            cases[ncases++] = case_n;
        } else if (match(p, TT_DEFAULT)) {
            consume(p, TT_COLON, "Expected ':' after default");
            ASTNode *def_n = make_node(NT_DEFAULT_STMT, ct->line, ct->column);
            int stmt_cap = 8, nstmts = 0;
            ASTNode **stmts = palloc(sizeof(ASTNode*) * stmt_cap);
            while (current(p)->type != TT_CASE && current(p)->type != TT_DEFAULT &&
                   current(p)->type != TT_RIGHT_BRACE && current(p)->type != TT_EOF) {
                ASTNode *stmt = parse_statement(p);
                if (!stmt) break;
                if (nstmts >= stmt_cap) {
                    stmt_cap *= 2;
                    ASTNode **na = palloc(sizeof(ASTNode*) * stmt_cap);
                    memcpy(na, stmts, sizeof(ASTNode*) * nstmts);
                    stmts = na;
                }
                stmts[nstmts++] = stmt;
            }
            def_n->u.default_stmt.stmts = stmts;
            def_n->u.default_stmt.nstmts = nstmts;
            if (ncases >= cap) {
                cap *= 2;
                ASTNode **na = palloc(sizeof(ASTNode*) * cap);
                memcpy(na, cases, sizeof(ASTNode*) * ncases);
                cases = na;
            }
            cases[ncases++] = def_n;
        } else {
            /* stray statement in switch */
            ASTNode *stmt = parse_statement(p);
            if (!stmt) break;
        }
    }
    ASTNode *n = make_node(NT_SWITCH_STMT, t->line, t->column);
    n->u.switch_stmt.expr = expr;
    n->u.switch_stmt.cases = cases;
    n->u.switch_stmt.ncases = ncases;
    return n;
}

/* ========================================================================
   Declaration parsing
   ======================================================================== */

static TypeSpec *parse_type_specifier(Parser *p) {
    Token *t = current(p);
    TypeSpec *ts = make_typespec("");

    /* type qualifiers */
    while (match(p, TT_CONST) || match(p, TT_VOLATILE) || match(p, TT_RESTRICT) ||
           match(p, TT_UNDERSCORE_RESTRICT) || match(p, TT_INLINE) || match(p, TT_UNDERSCORE_INLINE) ||
           match(p, TT_EXTERN) || match(p, TT_STATIC) || match(p, TT_AUTO) || match(p, TT_REGISTER)) {
        /* store qualifiers somehow? for now, skip them in the type name */
    }

    /* primitive types */
    if (match(p, TT_INT) || match(p, TT_CHAR) || match(p, TT_VOID) || match(p, TT_LONG) ||
        match(p, TT_SHORT) || match(p, TT_UNSIGNED) || match(p, TT_SIGNED) || match(p, TT_FLOAT) ||
        match(p, TT_DOUBLE) || match(p, TT_BOOL)) {
        ts->type_name = pstrdup(t->value);
    } else if (match(p, TT_STRUCT)) {
        Token *name = NULL;
        if (current(p)->type == TT_IDENTIFIER) {
            name = advance(p);
        }
        if (match(p, TT_LEFT_BRACE)) {
            /* struct definition */
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
            /* parse members */
            while (!match(p, TT_RIGHT_BRACE)) {
                if (current(p)->type == TT_EOF) break;
                parse_declaration(p); /* parse and ignore for now */
            }
        } else {
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
        }
    } else if (match(p, TT_UNION)) {
        Token *name = NULL;
        if (current(p)->type == TT_IDENTIFIER) name = advance(p);
        if (match(p, TT_LEFT_BRACE)) {
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
            while (!match(p, TT_RIGHT_BRACE)) {
                if (current(p)->type == TT_EOF) break;
                parse_declaration(p);
            }
        } else {
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
        }
    } else if (match(p, TT_ENUM)) {
        Token *name = NULL;
        if (current(p)->type == TT_IDENTIFIER) name = advance(p);
        if (match(p, TT_LEFT_BRACE)) {
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
            while (!match(p, TT_RIGHT_BRACE)) {
                if (current(p)->type == TT_EOF) break;
                if (current(p)->type == TT_IDENTIFIER) advance(p);
                if (match(p, TT_ASSIGN)) parse_expression(p);
                match(p, TT_COMMA);
            }
        } else {
            ts->type_name = pstrdup(name ? name->value : "<anonymous>");
        }
    } else if (match(p, TT_IDENTIFIER)) {
        /* typedef'd name */
        ts->type_name = pstrdup(t->value);
    } else {
        return NULL; /* no type */
    }

    /* pointer qualifiers */
    while (match(p, TT_MULTIPLY)) {
        ts->is_pointer = 1;
        ts->pointer_count++;
        while (match(p, TT_CONST) || match(p, TT_VOLATILE)) {}
    }

    return ts;
}

static ASTNode *parse_parameters(Parser *p);

static ASTNode *parse_declaration(Parser *p) {
    Token *t = current(p);
    char *storage = NULL;

    /* storage class / qualifiers before type */
    while (match(p, TT_EXTERN) || match(p, TT_STATIC) || match(p, TT_INLINE) ||
           match(p, TT_UNDERSCORE_INLINE) || match(p, TT_VOLATILE) || match(p, TT_CONST)) {
        if (!storage) storage = pstrdup(t->value);
    }

    TypeSpec *base_type = parse_type_specifier(p);
    if (!base_type) return NULL;

    /* Check if this is a typedef */
    if (strcmp(base_type->type_name, "typedef") == 0 ||
        (storage && strcmp(storage, "typedef") == 0)) {
        /* re-parse properly */
        /* TODO: proper typedef parsing */
        return NULL;
    }

    /* First declarator */
    Token *name = NULL;
    if (current(p)->type == TT_IDENTIFIER) name = advance(p);

    /* Array or function pointer? */
    if (match(p, TT_LEFT_BRACKET)) {
        /* array declaration */
        if (!match(p, TT_RIGHT_BRACKET)) {
            (void)parse_expression(p);
            consume(p, TT_RIGHT_BRACKET, "Expected ']' after array size");
        }
        base_type->is_pointer = 1; /* treat array as pointer for now */
    } else if (match(p, TT_LEFT_PAREN)) {
        /* function declaration */
        ASTNode *func = make_node(NT_FUNCTION_DECL, t->line, t->column);
        func->u.func.ret_type = base_type;
        func->u.func.name = name ? pstrdup(name->value) : pstrdup("<anonymous>");
        func->u.func.storage = storage;
        ASTNode *params = parse_parameters(p);
        func->u.func.params = params ? params->u.compound.stmts : NULL;
        func->u.func.nparam = params ? params->u.compound.nstmts : 0;
        if (match(p, TT_LEFT_BRACE)) {
            func->u.func.body = parse_compound_statement(p);
        }
        return func;
    }

    /* Variable declaration(s) */
    int cap = 4, ndecls = 0;
    ASTNode **decls = palloc(sizeof(ASTNode*) * cap);

    ASTNode *decl = make_node(NT_DECLARATION, t->line, t->column);
    decl->u.decl.var_type = base_type;
    decl->u.decl.name = name ? pstrdup(name->value) : NULL;
    decl->u.decl.storage = storage;
    if (match(p, TT_ASSIGN)) {
        decl->u.decl.init = parse_expression(p);
    }
    decls[ndecls++] = decl;

    while (match(p, TT_COMMA)) {
        Token *next_name = consume(p, TT_IDENTIFIER, "Expected identifier in declaration");
        TypeSpec *ts = make_typespec(base_type->type_name);
        ts->is_pointer = base_type->is_pointer;
        ts->pointer_count = base_type->pointer_count;
        ASTNode *d = make_node(NT_DECLARATION, t->line, t->column);
        d->u.decl.var_type = ts;
        d->u.decl.name = pstrdup(next_name->value);
        d->u.decl.storage = storage ? pstrdup(storage) : NULL;
        if (match(p, TT_ASSIGN))
            d->u.decl.init = parse_expression(p);
        if (ndecls >= cap) {
            cap *= 2;
            ASTNode **na = palloc(sizeof(ASTNode*) * cap);
            memcpy(na, decls, sizeof(ASTNode*) * ndecls);
            decls = na;
        }
        decls[ndecls++] = d;
    }

    consume(p, TT_SEMICOLON, "Expected ';' after declaration");

    if (ndecls == 1) return decls[0];
    ASTNode *multi = make_node(NT_MULTI_DECLARATION, t->line, t->column);
    multi->u.multi.decls = decls;
    multi->u.multi.ndecls = ndecls;
    return multi;
}

static ASTNode *parse_parameters(Parser *p) {
    Token *t = current(p);
    /* we already consumed '(' */
    int cap = 8, nparams = 0;
    ASTNode **params = palloc(sizeof(ASTNode*) * cap);
    while (!match(p, TT_RIGHT_PAREN)) {
        if (current(p)->type == TT_EOF) break;
        if (nparams > 0) consume(p, TT_COMMA, "Expected ',' between parameters");
        if (match(p, TT_ELLIPSIS)) {
            /* varargs */
            break;
        }
        TypeSpec *ts = parse_type_specifier(p);
        Token *name = NULL;
        if (current(p)->type == TT_IDENTIFIER) name = advance(p);
        ASTNode *param = make_node(NT_PARAMETER, t->line, t->column);
        param->u.param.var_type = ts;
        param->u.param.name = name ? pstrdup(name->value) : NULL;
        if (nparams >= cap) {
            cap *= 2;
            ASTNode **na = palloc(sizeof(ASTNode*) * cap);
            memcpy(na, params, sizeof(ASTNode*) * nparams);
            params = na;
        }
        params[nparams++] = param;
    }
    /* Return as compound statement for easy handling */
    ASTNode *n = make_node(NT_COMPOUND_STMT, t->line, t->column);
    n->u.compound.stmts = params;
    n->u.compound.nstmts = nparams;
    return n;
}

/* ========================================================================
   Top-level program parsing
   ======================================================================== */

static ASTNode *parse_program(Parser *p) {
    Token *t = current(p);
    int cap = 16, ndecls = 0;
    ASTNode **decls = palloc(sizeof(ASTNode*) * cap);
    while (current(p)->type != TT_EOF) {
        /* Skip preprocessor directives */
        if (match(p, TT_PREPROCESSOR)) continue;
        ASTNode *decl = parse_declaration(p);
        if (!decl) {
            /* try to recover */
            advance(p);
            continue;
        }
        if (ndecls >= cap) {
            cap *= 2;
            ASTNode **na = palloc(sizeof(ASTNode*) * cap);
            memcpy(na, decls, sizeof(ASTNode*) * ndecls);
            decls = na;
        }
        decls[ndecls++] = decl;
    }
    ASTNode *prog = make_node(NT_PROGRAM, t->line, t->column);
    prog->u.program.decls = decls;
    prog->u.program.ndecls = ndecls;
    return prog;
}

ASTNode *parser_parse(Parser *p) {
    return parse_program(p);
}

/* ========================================================================
   Cleanup
   ======================================================================== */

void ast_free(ASTNode *node) {
    (void)node;
    /* arena-based; nothing to free individually */
}

TypeSpec *typespec_dup(TypeSpec *t) {
    if (!t) return NULL;
    TypeSpec *d = palloc(sizeof(TypeSpec));
    *d = *t;
    d->type_name = pstrdup(t->type_name);
    return d;
}

void typespec_free(TypeSpec *t) {
    (void)t;
    /* arena-based */
}

