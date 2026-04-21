#ifndef LEXER_H
#define LEXER_H

#include <stddef.h>

typedef enum {
    /* keywords */
    TT_INT, TT_CHAR, TT_VOID, TT_LONG, TT_SHORT,
    TT_UNSIGNED, TT_SIGNED, TT_IF, TT_ELSE, TT_WHILE,
    TT_FOR, TT_RETURN, TT_STRUCT, TT_ASM, TT_VOLATILE,
    TT_EXPORT_SYMBOL, TT_INIT, TT_SIZEOF, TT_TYPEDEF,
    TT_SWITCH, TT_CASE, TT_DEFAULT, TT_BREAK, TT_CONTINUE,
    TT_ENUM, TT_UNION, TT_EXTERN, TT_CONST, TT_INLINE,
    TT_DO, TT_GOTO, TT_REGISTER, TT_AUTO, TT_BOOL,
    TT_FLOAT, TT_DOUBLE, TT_RESTRICT, TT_NORETURN,
    TT_ALIGNAS, TT_ALIGNOF, TT_STATIC_ASSERT, TT_THREAD_LOCAL,
    TT_ATTRIBUTE, TT_EXTENSION, TT_TYPEOF,
    TT_UNDERSCORE_INLINE, TT_UNDERSCORE_RESTRICT,
    TT_STATIC,
    /* identifiers and literals */
    TT_IDENTIFIER, TT_NUMBER, TT_STRING, TT_CHARACTER,
    /* operators */
    TT_PLUS, TT_MINUS, TT_MULTIPLY, TT_DIVIDE, TT_MODULO,
    TT_ASSIGN, TT_EQUAL, TT_NOT_EQUAL,
    TT_LESS_THAN, TT_GREATER_THAN, TT_LESS_EQUAL, TT_GREATER_EQUAL,
    TT_AND, TT_OR, TT_NOT,
    TT_BITWISE_AND, TT_BITWISE_OR, TT_BITWISE_XOR,
    TT_LEFT_SHIFT, TT_RIGHT_SHIFT,
    TT_INCREMENT, TT_DECREMENT,
    /* compound assignment */
    TT_PLUS_ASSIGN, TT_MINUS_ASSIGN, TT_MULTIPLY_ASSIGN,
    TT_DIVIDE_ASSIGN, TT_MODULO_ASSIGN, TT_AND_ASSIGN,
    TT_OR_ASSIGN, TT_XOR_ASSIGN,
    TT_LEFT_SHIFT_ASSIGN, TT_RIGHT_SHIFT_ASSIGN,
    TT_ARROW, TT_ELLIPSIS, TT_TILDE,
    /* delimiters */
    TT_SEMICOLON, TT_COMMA, TT_DOT, TT_COLON, TT_QUESTION,
    /* brackets */
    TT_LEFT_PAREN, TT_RIGHT_PAREN,
    TT_LEFT_BRACE, TT_RIGHT_BRACE,
    TT_LEFT_BRACKET, TT_RIGHT_BRACKET,
    /* special */
    TT_EOF, TT_NEWLINE, TT_PREPROCESSOR,
    TT_HASH,
} TokenType;

typedef struct {
    TokenType type;
    char     *value;   /* heap-allocated */
    int       line;
    int       column;
} Token;

typedef struct {
    const char *input;
    size_t      len;
    size_t      pos;
    int         line;
    int         column;
} Lexer;

void     lexer_init(Lexer *l, const char *input);
Token   *lexer_next_token(Lexer *l);
Token  **lexer_tokenize(Lexer *l, int *count);
void     token_free(Token *t);
void     tokens_free(Token **tokens, int count);
const char *token_type_name(TokenType type);

#endif /* LEXER_H */
