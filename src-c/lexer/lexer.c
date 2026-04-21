#include "lexer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static const struct { const char *word; TokenType type; } KEYWORDS[] = {
    {"int",              TT_INT},
    {"char",             TT_CHAR},
    {"void",             TT_VOID},
    {"long",             TT_LONG},
    {"short",            TT_SHORT},
    {"unsigned",         TT_UNSIGNED},
    {"signed",           TT_SIGNED},
    {"if",               TT_IF},
    {"else",             TT_ELSE},
    {"while",            TT_WHILE},
    {"for",              TT_FOR},
    {"return",           TT_RETURN},
    {"struct",           TT_STRUCT},
    {"asm",              TT_ASM},
    {"__asm__",          TT_ASM},
    {"volatile",         TT_VOLATILE},
    {"__volatile__",     TT_VOLATILE},
    {"EXPORT_SYMBOL",    TT_EXPORT_SYMBOL},
    {"__init",           TT_INIT},
    {"static",           TT_STATIC},
    {"sizeof",           TT_SIZEOF},
    {"typedef",          TT_TYPEDEF},
    {"switch",           TT_SWITCH},
    {"case",             TT_CASE},
    {"default",          TT_DEFAULT},
    {"break",            TT_BREAK},
    {"continue",         TT_CONTINUE},
    {"enum",             TT_ENUM},
    {"union",            TT_UNION},
    {"extern",           TT_EXTERN},
    {"const",            TT_CONST},
    {"inline",           TT_INLINE},
    {"__inline__",       TT_UNDERSCORE_INLINE},
    {"do",               TT_DO},
    {"goto",             TT_GOTO},
    {"register",         TT_REGISTER},
    {"auto",             TT_AUTO},
    {"_Bool",            TT_BOOL},
    {"float",            TT_FLOAT},
    {"double",           TT_DOUBLE},
    {"restrict",         TT_RESTRICT},
    {"__restrict__",     TT_UNDERSCORE_RESTRICT},
    {"_Noreturn",        TT_NORETURN},
    {"_Alignas",         TT_ALIGNAS},
    {"_Alignof",         TT_ALIGNOF},
    {"_Static_assert",   TT_STATIC_ASSERT},
    {"_Thread_local",    TT_THREAD_LOCAL},
    {"__attribute__",    TT_ATTRIBUTE},
    {"__extension__",    TT_EXTENSION},
    {"__typeof__",       TT_TYPEOF},
    {"typeof",           TT_TYPEOF},
    {NULL,               TT_EOF},
};

void lexer_init(Lexer *l, const char *input) {
    l->input  = input;
    l->len    = strlen(input);
    l->pos    = 0;
    l->line   = 1;
    l->column = 1;
}

static int peek(const Lexer *l, int offset) {
    size_t p = l->pos + (size_t)offset;
    return (p < l->len) ? (unsigned char)l->input[p] : '\0';
}

static int advance(Lexer *l) {
    int c = peek(l, 0);
    l->pos++;
    if (c == '\n') { l->line++; l->column = 1; }
    else           { l->column++; }
    return c;
}

static Token *make_token(TokenType type, const char *buf, size_t blen,
                         int line, int col) {
    Token *t  = malloc(sizeof(Token));
    t->type   = type;
    t->value  = malloc(blen + 1);
    memcpy(t->value, buf, blen);
    t->value[blen] = '\0';
    t->line   = line;
    t->column = col;
    return t;
}

static void skip_whitespace(Lexer *l) {
    while (l->pos < l->len) {
        int c = peek(l, 0);
        if (c == ' ' || c == '\t' || c == '\r' || c == '\f' || c == '\v')
            advance(l);
        else break;
    }
}

static void skip_line_comment(Lexer *l) {
    while (l->pos < l->len && peek(l, 0) != '\n')
        advance(l);
}

static void skip_block_comment(Lexer *l) {
    /* already consumed '/' '*' */
    while (l->pos < l->len) {
        if (peek(l, 0) == '*' && peek(l, 1) == '/') {
            advance(l); advance(l);
            return;
        }
        advance(l);
    }
}

static Token *read_preproc(Lexer *l, int line, int col) {
    size_t start = l->pos - 1; /* '#' already not consumed; caller didn't advance */
    advance(l); /* skip '#' */
    /* read to end of logical line */
    while (l->pos < l->len && peek(l, 0) != '\n')
        advance(l);
    size_t blen = l->pos - start;
    return make_token(TT_PREPROCESSOR, l->input + start, blen, line, col);
}

static Token *read_number(Lexer *l, int line, int col) {
    size_t start = l->pos;
    if (peek(l, 0) == '0') {
        advance(l);
        if (peek(l, 0) == 'x' || peek(l, 0) == 'X') {
            advance(l);
            while (isxdigit(peek(l, 0))) advance(l);
        } else if (peek(l, 0) >= '0' && peek(l, 0) <= '7') {
            while (peek(l, 0) >= '0' && peek(l, 0) <= '7') advance(l);
        }
    } else {
        while (isdigit(peek(l, 0))) advance(l);
        if (peek(l, 0) == '.') {
            advance(l);
            while (isdigit(peek(l, 0))) advance(l);
        }
        if (peek(l, 0) == 'e' || peek(l, 0) == 'E') {
            advance(l);
            if (peek(l, 0) == '+' || peek(l, 0) == '-') advance(l);
            while (isdigit(peek(l, 0))) advance(l);
        }
    }
    /* suffixes */
    if (peek(l, 0) == 'f' || peek(l, 0) == 'F') {
        advance(l);
    } else if (peek(l, 0) == 'u' || peek(l, 0) == 'U') {
        advance(l);
        if (peek(l, 0) == 'l' || peek(l, 0) == 'L') {
            advance(l);
            if (peek(l, 0) == 'l' || peek(l, 0) == 'L') advance(l);
        }
    } else if (peek(l, 0) == 'l' || peek(l, 0) == 'L') {
        advance(l);
        if (peek(l, 0) == 'l' || peek(l, 0) == 'L') advance(l);
        if (peek(l, 0) == 'u' || peek(l, 0) == 'U') advance(l);
    }
    return make_token(TT_NUMBER, l->input + start, l->pos - start, line, col);
}

static Token *read_identifier(Lexer *l, int line, int col) {
    size_t start = l->pos;
    while (l->pos < l->len) {
        int c = peek(l, 0);
        if (isalnum(c) || c == '_') advance(l);
        else break;
    }
    size_t blen = l->pos - start;
    char tmp[256];
    size_t cplen = blen < 255 ? blen : 255;
    memcpy(tmp, l->input + start, cplen);
    tmp[cplen] = '\0';
    /* keyword lookup */
    for (int i = 0; KEYWORDS[i].word; i++) {
        if (strcmp(tmp, KEYWORDS[i].word) == 0)
            return make_token(KEYWORDS[i].type, tmp, strlen(tmp), line, col);
    }
    return make_token(TT_IDENTIFIER, l->input + start, blen, line, col);
}

static Token *read_string(Lexer *l, char quote, int line, int col) {
    size_t start = l->pos;
    advance(l); /* opening quote */
    while (l->pos < l->len && peek(l, 0) != quote) {
        if (peek(l, 0) == '\\') advance(l);
        if (l->pos < l->len) advance(l);
    }
    if (l->pos < l->len) advance(l); /* closing quote */
    TokenType tt = (quote == '"') ? TT_STRING : TT_CHARACTER;
    return make_token(tt, l->input + start, l->pos - start, line, col);
}

static TokenType op2type(const char *s) {
    /* single char */
    if (!s[1]) {
        switch (s[0]) {
        case '+': return TT_PLUS;     case '-': return TT_MINUS;
        case '*': return TT_MULTIPLY; case '/': return TT_DIVIDE;
        case '%': return TT_MODULO;   case '=': return TT_ASSIGN;
        case '<': return TT_LESS_THAN; case '>': return TT_GREATER_THAN;
        case '!': return TT_NOT;       case '&': return TT_BITWISE_AND;
        case '|': return TT_BITWISE_OR; case '^': return TT_BITWISE_XOR;
        case '~': return TT_TILDE;     case ';': return TT_SEMICOLON;
        case ',': return TT_COMMA;     case '.': return TT_DOT;
        case ':': return TT_COLON;     case '?': return TT_QUESTION;
        case '(': return TT_LEFT_PAREN; case ')': return TT_RIGHT_PAREN;
        case '{': return TT_LEFT_BRACE; case '}': return TT_RIGHT_BRACE;
        case '[': return TT_LEFT_BRACKET; case ']': return TT_RIGHT_BRACKET;
        case '#': return TT_HASH;
        }
    }
    /* two char */
    if (s[0]=='+' && s[1]=='=') return TT_PLUS_ASSIGN;
    if (s[0]=='-' && s[1]=='=') return TT_MINUS_ASSIGN;
    if (s[0]=='*' && s[1]=='=') return TT_MULTIPLY_ASSIGN;
    if (s[0]=='/' && s[1]=='=') return TT_DIVIDE_ASSIGN;
    if (s[0]=='%' && s[1]=='=') return TT_MODULO_ASSIGN;
    if (s[0]=='&' && s[1]=='=') return TT_AND_ASSIGN;
    if (s[0]=='|' && s[1]=='=') return TT_OR_ASSIGN;
    if (s[0]=='^' && s[1]=='=') return TT_XOR_ASSIGN;
    if (s[0]=='=' && s[1]=='=') return TT_EQUAL;
    if (s[0]=='!' && s[1]=='=') return TT_NOT_EQUAL;
    if (s[0]=='<' && s[1]=='=') return TT_LESS_EQUAL;
    if (s[0]=='>' && s[1]=='=') return TT_GREATER_EQUAL;
    if (s[0]=='&' && s[1]=='&') return TT_AND;
    if (s[0]=='|' && s[1]=='|') return TT_OR;
    if (s[0]=='+' && s[1]=='+') return TT_INCREMENT;
    if (s[0]=='-' && s[1]=='-') return TT_DECREMENT;
    if (s[0]=='-' && s[1]=='>') return TT_ARROW;
    if (s[0]=='<' && s[1]=='<') return TT_LEFT_SHIFT;
    if (s[0]=='>' && s[1]=='>') return TT_RIGHT_SHIFT;
    /* three char */
    if (s[0]=='<' && s[1]=='<' && s[2]=='=') return TT_LEFT_SHIFT_ASSIGN;
    if (s[0]=='>' && s[1]=='>' && s[2]=='=') return TT_RIGHT_SHIFT_ASSIGN;
    if (s[0]=='.' && s[1]=='.' && s[2]=='.') return TT_ELLIPSIS;
    return TT_EOF; /* unknown */
}

static Token *read_operator(Lexer *l, int line, int col) {
    size_t start = l->pos;
    char buf[4] = {0};
    int c  = peek(l, 0);
    int n  = peek(l, 1);
    int n2 = peek(l, 2);
    /* three-char */
    if ((c=='<'&&n=='<'&&n2=='=') || (c=='>'&&n=='>'&&n2=='=') ||
        (c=='.'&&n=='.'&&n2=='.')) {
        advance(l); advance(l); advance(l);
        buf[0]=(char)c; buf[1]=(char)n; buf[2]=(char)n2;
        return make_token(op2type(buf), l->input+start, 3, line, col);
    }
    /* two-char */
    if (n && strchr("+-*/%=!<>&|^", c) && (
        (c=='='&&n=='=') || (c=='!'&&n=='=') || (c=='<'&&n=='=') ||
        (c=='>'&&n=='=') || (c=='&'&&n=='&') || (c=='|'&&n=='|') ||
        (c=='+'&&n=='+') || (c=='-'&&n=='-') || (c=='-'&&n=='>') ||
        (c=='+'&&n=='=') || (c=='-'&&n=='=') || (c=='*'&&n=='=') ||
        (c=='/'&&n=='=') || (c=='%'&&n=='=') || (c=='&'&&n=='=') ||
        (c=='|'&&n=='=') || (c=='^'&&n=='=') || (c=='<'&&n=='<') ||
        (c=='>'&&n=='>'))) {
        advance(l); advance(l);
        buf[0]=(char)c; buf[1]=(char)n;
        return make_token(op2type(buf), l->input+start, 2, line, col);
    }
    advance(l);
    buf[0]=(char)c;
    return make_token(op2type(buf), l->input+start, 1, line, col);
}

Token *lexer_next_token(Lexer *l) {
top:
    skip_whitespace(l);
    if (l->pos >= l->len) {
        return make_token(TT_EOF, "", 0, l->line, l->column);
    }
    int line = l->line, col = l->column;
    int c = peek(l, 0);

    /* line comment */
    if (c == '/' && peek(l, 1) == '/') {
        advance(l); advance(l);
        skip_line_comment(l);
        goto top;
    }
    /* block comment */
    if (c == '/' && peek(l, 1) == '*') {
        advance(l); advance(l);
        skip_block_comment(l);
        goto top;
    }
    /* newline */
    if (c == '\n') {
        advance(l);
        /* Return a special preprocessor-skip token but continue */
        goto top;
    }
    /* preprocessor directive or line marker */
    if (c == '#') {
        return read_preproc(l, line, col);
    }
    if (isdigit(c)) return read_number(l, line, col);
    if (isalpha(c) || c == '_') return read_identifier(l, line, col);
    if (c == '"' || c == '\'') return read_string(l, (char)c, line, col);
    if (strchr("+-*/%=!<>&|^?:;,.()[]{}#~", c))
        return read_operator(l, line, col);

    /* unknown character - skip */
    advance(l);
    goto top;
}

Token **lexer_tokenize(Lexer *l, int *count) {
    int cap = 64, n = 0;
    Token **tokens = malloc(sizeof(Token *) * (size_t)cap);
    Token *t;
    while ((t = lexer_next_token(l))->type != TT_EOF) {
        if (n >= cap) { cap *= 2; tokens = realloc(tokens, sizeof(Token *) * (size_t)cap); }
        tokens[n++] = t;
    }
    /* include EOF */
    if (n >= cap) { cap++; tokens = realloc(tokens, sizeof(Token *) * (size_t)cap); }
    tokens[n++] = t;
    *count = n;
    return tokens;
}

void token_free(Token *t) {
    if (!t) return;
    free(t->value);
    free(t);
}

void tokens_free(Token **tokens, int count) {
    if (!tokens) return;
    for (int i = 0; i < count; i++) token_free(tokens[i]);
    free(tokens);
}

const char *token_type_name(TokenType type) {
    switch (type) {
    case TT_INT: return "int"; case TT_CHAR: return "char";
    case TT_VOID: return "void"; case TT_LONG: return "long";
    case TT_SHORT: return "short"; case TT_UNSIGNED: return "unsigned";
    case TT_SIGNED: return "signed"; case TT_IF: return "if";
    case TT_ELSE: return "else"; case TT_WHILE: return "while";
    case TT_FOR: return "for"; case TT_RETURN: return "return";
    case TT_STRUCT: return "struct"; case TT_ASM: return "asm";
    case TT_VOLATILE: return "volatile"; case TT_STATIC: return "static";
    case TT_SIZEOF: return "sizeof"; case TT_TYPEDEF: return "typedef";
    case TT_SWITCH: return "switch"; case TT_CASE: return "case";
    case TT_DEFAULT: return "default"; case TT_BREAK: return "break";
    case TT_CONTINUE: return "continue"; case TT_ENUM: return "enum";
    case TT_UNION: return "union"; case TT_EXTERN: return "extern";
    case TT_CONST: return "const"; case TT_INLINE: return "inline";
    case TT_DO: return "do"; case TT_GOTO: return "goto";
    case TT_IDENTIFIER: return "IDENTIFIER"; case TT_NUMBER: return "NUMBER";
    case TT_STRING: return "STRING"; case TT_CHARACTER: return "CHARACTER";
    case TT_PLUS: return "+"; case TT_MINUS: return "-";
    case TT_MULTIPLY: return "*"; case TT_DIVIDE: return "/";
    case TT_ASSIGN: return "="; case TT_EQUAL: return "==";
    case TT_NOT_EQUAL: return "!="; case TT_LESS_THAN: return "<";
    case TT_GREATER_THAN: return ">"; case TT_LESS_EQUAL: return "<=";
    case TT_GREATER_EQUAL: return ">="; case TT_AND: return "&&";
    case TT_OR: return "||"; case TT_NOT: return "!";
    case TT_SEMICOLON: return ";"; case TT_COMMA: return ",";
    case TT_LEFT_PAREN: return "("; case TT_RIGHT_PAREN: return ")";
    case TT_LEFT_BRACE: return "{"; case TT_RIGHT_BRACE: return "}";
    case TT_LEFT_BRACKET: return "["; case TT_RIGHT_BRACKET: return "]";
    case TT_EOF: return "EOF"; case TT_PREPROCESSOR: return "PREPROCESSOR";
    case TT_ARROW: return "->"; case TT_ELLIPSIS: return "...";
    case TT_INCREMENT: return "++"; case TT_DECREMENT: return "--";
    case TT_TILDE: return "~"; case TT_DOT: return ".";
    case TT_COLON: return ":"; case TT_QUESTION: return "?";
    default: return "UNKNOWN";
    }
}
