#ifndef PARSER_H
#define PARSER_H

#include "../lexer/lexer.h"
#include <stddef.h>

/* ---- Node types ---- */
typedef enum {
    NT_PROGRAM,
    NT_FUNCTION_DECL,
    NT_PARAMETER,
    NT_COMPOUND_STMT,
    NT_DECLARATION,
    NT_MULTI_DECLARATION,
    NT_ASSIGNMENT,
    NT_IF_STMT,
    NT_WHILE_STMT,
    NT_FOR_STMT,
    NT_DO_WHILE_STMT,
    NT_GOTO_STMT,
    NT_LABEL_STMT,
    NT_EMPTY_STMT,
    NT_RETURN_STMT,
    NT_EXPR_STMT,
    NT_BREAK_STMT,
    NT_CONTINUE_STMT,
    NT_SWITCH_STMT,
    NT_CASE_STMT,
    NT_DEFAULT_STMT,
    NT_BINARY_EXPR,
    NT_UNARY_EXPR,
    NT_POSTFIX_EXPR,
    NT_FUNCTION_CALL,
    NT_TERNARY_EXPR,
    NT_IDENTIFIER,
    NT_NUMBER_LIT,
    NT_STRING_LIT,
    NT_CHAR_LIT,
    NT_TYPE_SPEC,
    NT_SIZEOF_EXPR,
    NT_TYPEOF_EXPR,
    NT_CAST_EXPR,
    NT_MEMBER_ACCESS,
    NT_ARRAY_ACCESS,
    NT_INITIALIZER_LIST,
    NT_COMPOUND_LITERAL,
    NT_STATEMENT_EXPR,
    NT_EMPTY_EXPR,
    NT_STRUCT_DECL,
    NT_UNION_DECL,
    NT_ENUM_DECL,
    NT_TYPEDEF_DECL,
    NT_ASM_STMT,
    NT_EXPORT_SYMBOL,
    NT_ATTRIBUTE_STMT,
    NT_PREPROCESSOR_STMT,
} NodeType;

/* forward declaration */
struct ASTNode;

/* ---- Type specifier ---- */
typedef struct TypeSpec {
    char   *type_name;     /* e.g. "int", "struct foo", "void" */
    int     is_pointer;
    int     pointer_count;
    /* qualifiers as bit flags */
    int     is_const;
    int     is_volatile;
    int     is_restrict;
    /* for function pointers */
    struct TypeSpec **params;
    int     num_params;
} TypeSpec;

/* ---- AST node ---- */
typedef struct ASTNode {
    NodeType type;
    int line, column;
    union {
        /* NT_PROGRAM */
        struct {
            struct ASTNode **decls;
            int ndecls;
        } program;
        /* NT_FUNCTION_DECL */
        struct {
            TypeSpec       *ret_type;
            char           *name;
            struct ASTNode **params;  /* NT_PARAMETER nodes */
            int             nparam;
            struct ASTNode *body;     /* NT_COMPOUND_STMT or NULL */
            char           *storage;  /* "extern","static","inline",NULL */
        } func;
        /* NT_PARAMETER */
        struct {
            TypeSpec       *var_type;
            char           *name;
        } param;
        /* NT_COMPOUND_STMT */
        struct {
            struct ASTNode **stmts;
            int             nstmts;
        } compound;
        /* NT_DECLARATION */
        struct {
            TypeSpec       *var_type;
            char           *name;
            struct ASTNode *init;   /* initializer expression or NULL */
            char           *storage;
        } decl;
        /* NT_MULTI_DECLARATION */
        struct {
            struct ASTNode **decls;
            int             ndecls;
        } multi;
        /* NT_ASSIGNMENT */
        struct {
            struct ASTNode *target;
            struct ASTNode *value;
            char           *op;     /* "=", "+=", etc. */
        } assign;
        /* NT_IF_STMT */
        struct {
            struct ASTNode *cond;
            struct ASTNode *then_br;
            struct ASTNode *else_br; /* NULL if no else */
        } if_stmt;
        /* NT_WHILE_STMT / NT_DO_WHILE_STMT */
        struct {
            struct ASTNode *cond;
            struct ASTNode *body;
        } loop;
        /* NT_FOR_STMT */
        struct {
            struct ASTNode *init;   /* decl or expr_stmt or NULL */
            struct ASTNode *cond;
            struct ASTNode *incr;
            struct ASTNode *body;
        } for_stmt;
        /* NT_RETURN_STMT */
        struct {
            struct ASTNode *value;  /* NULL for void return */
        } ret;
        /* NT_EXPR_STMT */
        struct {
            struct ASTNode *expr;
        } expr_stmt;
        /* NT_BINARY_EXPR */
        struct {
            char           *op;
            struct ASTNode *left;
            struct ASTNode *right;
        } binary;
        /* NT_UNARY_EXPR */
        struct {
            char           *op;
            struct ASTNode *operand;
        } unary;
        /* NT_POSTFIX_EXPR */
        struct {
            char           *op;
            struct ASTNode *operand;
        } postfix;
        /* NT_FUNCTION_CALL */
        struct {
            struct ASTNode  *callee;
            struct ASTNode **args;
            int              nargs;
        } call;
        /* NT_TERNARY_EXPR */
        struct {
            struct ASTNode *cond;
            struct ASTNode *then_expr;
            struct ASTNode *else_expr;
        } ternary;
        /* NT_IDENTIFIER */
        struct { char *name; } ident;
        /* NT_NUMBER_LIT */
        struct { char *value; } number;
        /* NT_STRING_LIT / NT_CHAR_LIT */
        struct { char *value; } str_lit;
        /* NT_TYPE_SPEC (standalone sizeof type) */
        struct { TypeSpec *spec; } type_spec;
        /* NT_SIZEOF_EXPR / NT_TYPEOF_EXPR */
        struct {
            struct ASTNode *operand; /* NULL if is_type */
            TypeSpec       *type;    /* NULL if !is_type */
            int             is_type;
        } szexpr;
        /* NT_CAST_EXPR */
        struct {
            TypeSpec       *target_type;
            struct ASTNode *operand;
        } cast;
        /* NT_MEMBER_ACCESS */
        struct {
            struct ASTNode *object;
            char           *member;
            int             arrow;   /* 1 if '->', 0 if '.' */
        } member;
        /* NT_ARRAY_ACCESS */
        struct {
            struct ASTNode *array;
            struct ASTNode *index;
        } arr;
        /* NT_INITIALIZER_LIST */
        struct {
            struct ASTNode **items;  /* each has optional designator */
            char          **designators; /* NULL or name */
            int             nitems;
        } init_list;
        /* NT_STATEMENT_EXPR */
        struct {
            struct ASTNode **stmts;
            int             nstmts;
        } stmt_expr;
        /* NT_STRUCT_DECL / NT_UNION_DECL */
        struct {
            char           *name;
            struct ASTNode **members; /* NT_DECLARATION nodes */
            int             nmembers;
        } struct_decl;
        /* NT_ENUM_DECL */
        struct {
            char  *name;
            char **enum_names;
            struct ASTNode **enum_values; /* NULL or expression */
            int    nenum;
        } enum_decl;
        /* NT_TYPEDEF_DECL */
        struct {
            TypeSpec *orig_type;
            char     *alias;
        } typedef_decl;
        /* NT_ASM_STMT */
        struct {
            char *assembly;
            int   is_volatile;
        } asm_stmt;
        /* NT_GOTO_STMT / NT_LABEL_STMT */
        struct { char *label; } label;
        /* NT_SWITCH_STMT */
        struct {
            struct ASTNode  *expr;
            struct ASTNode **cases;
            int              ncases;
        } switch_stmt;
        /* NT_CASE_STMT */
        struct {
            struct ASTNode  *value;
            struct ASTNode **stmts;
            int              nstmts;
        } case_stmt;
        /* NT_DEFAULT_STMT */
        struct {
            struct ASTNode **stmts;
            int              nstmts;
        } default_stmt;
        /* NT_ATTRIBUTE_STMT, NT_EXPORT_SYMBOL, NT_PREPROCESSOR_STMT */
        struct { char *text; } attr;
    } u;
} ASTNode;

/* ---- Parser ---- */
typedef struct {
    Token **tokens;
    int     count;
    int     pos;
} Parser;

void     parser_init(Parser *p, Token **tokens, int count);
ASTNode *parser_parse(Parser *p);
void     ast_free(ASTNode *node);
TypeSpec *typespec_dup(TypeSpec *t);
void     typespec_free(TypeSpec *t);

#endif /* PARSER_H */
