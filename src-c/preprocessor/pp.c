#define _POSIX_C_SOURCE 200809L
#include "pp.h"
#include "arena.h"
#include "vector.h"
#include "hash.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <assert.h>

// ============================================================================
// Utility helpers
// ============================================================================

static bool is_ident_start(char c) {
    return isalpha(c) || c == '_';
}

static bool is_ident_char(char c) {
    return isalnum(c) || c == '_';
}

static bool is_punct_start(char c) {
    return strchr("+-*/%=!<>&|^?:;,.()[]{}#~", c) != NULL;
}

// Forward declaration
static void skip_to_eol(Vector *tokens, int *idx);

// ============================================================================
// Context lifecycle
// ============================================================================

static PP_Context *make_context(const char **include_paths, int num_include_paths,
                                 const char **defines, int num_defines) {
    PP_Context *ctx = calloc(1, sizeof(PP_Context));
    if (!ctx) return NULL;
    ctx->arena = arena_create(65536);
    if (!ctx->arena) {
        free(ctx);
        return NULL;
    }
    ctx->macros = ht_create(256);
    ctx->included_files = ht_create(64);
    ctx->cond_cap = 16;
    ctx->cond_stack = calloc(ctx->cond_cap, sizeof(bool));
    if (!ctx->cond_stack) goto fail;

    // Store include paths
    ctx->num_include_paths = num_include_paths;
    if (num_include_paths > 0) {
        ctx->include_paths = malloc(sizeof(char *) * num_include_paths);
        if (!ctx->include_paths) goto fail;
        for (int i = 0; i < num_include_paths; i++) {
            ctx->include_paths[i] = strdup(include_paths[i]);
        }
    }

    // Pre-define macros from -D flags
    for (int i = 0; i < num_defines; i++) {
        const char *def = defines[i];
        const char *eq = strchr(def, '=');
        if (eq) {
            size_t namelen = eq - def;
            char *name = malloc(namelen + 1);
            memcpy(name, def, namelen);
            name[namelen] = '\0';
            PP_Macro *m = calloc(1, sizeof(PP_Macro));
            m->name = name;
            m->body = arena_alloc(ctx->arena, sizeof(PP_Token));
            m->body->type = PPT_NUMBER;
            m->body->text = arena_strdup(ctx->arena, eq + 1);
            m->body_len = 1;
            ht_insert(ctx->macros, name, m);
        } else {
            PP_Macro *m = calloc(1, sizeof(PP_Macro));
            m->name = strdup(def);
            m->body = arena_alloc(ctx->arena, sizeof(PP_Token));
            m->body->type = PPT_NUMBER;
            m->body->text = arena_strdup(ctx->arena, "1");
            m->body_len = 1;
            ht_insert(ctx->macros, def, m);
        }
    }

    // Built-in macros
    const char *builtins[][2] = {
        {"__STDC__", "1"},
        {"__STDC_VERSION__", "201710L"},
        {"__GNUC__", "11"},
        {"__linux__", "1"},
        {"__x86_64__", "1"},
    };
    for (size_t i = 0; i < sizeof(builtins) / sizeof(builtins[0]); i++) {
        PP_Macro *m = calloc(1, sizeof(PP_Macro));
        m->name = strdup(builtins[i][0]);
        m->body = arena_alloc(ctx->arena, sizeof(PP_Token));
        m->body->type = PPT_NUMBER;
        m->body->text = arena_strdup(ctx->arena, builtins[i][1]);
        m->body_len = 1;
        ht_insert(ctx->macros, builtins[i][0], m);
    }

    return ctx;
fail:
    arena_free(ctx->arena);
    ht_free(ctx->macros);
    free(ctx->cond_stack);
    free(ctx);
    return NULL;
}

static void free_context(PP_Context *ctx) {
    if (!ctx) return;
    // Free macros (allocated with calloc/malloc, not arena)
    // We need to free macro names and param arrays
    // For simplicity, iterate hash table
    // Note: macro bodies are in arena, freed with arena
    // Names and param arrays are malloc'd
    // We skip detailed cleanup since this is a short-lived process tool
    ht_free(ctx->macros);
    ht_free(ctx->included_files);
    arena_free(ctx->arena);
    for (int i = 0; i < ctx->num_include_paths; i++)
        free(ctx->include_paths[i]);
    free(ctx->include_paths);
    free(ctx->cond_stack);
    free(ctx);
}

// ============================================================================
// Source reading helpers
// ============================================================================

static char peek(PP_Context *ctx, size_t offset) {
    size_t p = ctx->pos + offset;
    if (p >= ctx->src_len) return '\0';
    return ctx->src[p];
}

static char advance(PP_Context *ctx) {
    if (ctx->pos >= ctx->src_len) return '\0';
    char c = ctx->src[ctx->pos++];
    if (c == '\n') {
        ctx->line++;
        ctx->col = 1;
    } else {
        ctx->col++;
    }
    return c;
}

static void skip_whitespace_no_newline(PP_Context *ctx) {
    while (peek(ctx, 0) == ' ' || peek(ctx, 0) == '\t' || peek(ctx, 0) == '\r')
        advance(ctx);
}

// ============================================================================
// Tokenizer
// ============================================================================

static PP_Token *make_token(PP_Context *ctx, PP_TokenType type, const char *text,
                            int line, int col) {
    PP_Token *t = arena_alloc(ctx->arena, sizeof(PP_Token));
    t->type = type;
    t->text = arena_strdup(ctx->arena, text);
    t->line = line;
    t->col = col;
    return t;
}

static PP_Token *read_string_token(PP_Context *ctx) {
    int line = ctx->line;
    int col = ctx->col;
    char quote = advance(ctx); // " or '
    char buf[4096];
    size_t i = 0;
    buf[i++] = quote;
    while (peek(ctx, 0) != quote && peek(ctx, 0) != '\0' && peek(ctx, 0) != '\n') {
        char c = advance(ctx);
        buf[i++] = c;
        if (c == '\\' && peek(ctx, 0) != '\0') {
            buf[i++] = advance(ctx);
        }
        if (i >= sizeof(buf) - 2) break;
    }
    if (peek(ctx, 0) == quote) {
        buf[i++] = advance(ctx);
    }
    buf[i] = '\0';
    PP_TokenType tt = (quote == '"') ? PPT_STRING : PPT_CHAR_LITERAL;
    return make_token(ctx, tt, buf, line, col);
}

static PP_Token *read_number_token(PP_Context *ctx) {
    int line = ctx->line;
    int col = ctx->col;
    char buf[256];
    size_t i = 0;
    // hex
    if (peek(ctx, 0) == '0' && (peek(ctx, 1) == 'x' || peek(ctx, 1) == 'X')) {
        buf[i++] = advance(ctx);
        buf[i++] = advance(ctx);
        while (isxdigit(peek(ctx, 0))) buf[i++] = advance(ctx);
    } else {
        while (isdigit(peek(ctx, 0))) buf[i++] = advance(ctx);
        if (peek(ctx, 0) == '.') {
            buf[i++] = advance(ctx);
            while (isdigit(peek(ctx, 0))) buf[i++] = advance(ctx);
        }
        if (peek(ctx, 0) == 'e' || peek(ctx, 0) == 'E') {
            buf[i++] = advance(ctx);
            if (peek(ctx, 0) == '+' || peek(ctx, 0) == '-') buf[i++] = advance(ctx);
            while (isdigit(peek(ctx, 0))) buf[i++] = advance(ctx);
        }
    }
    // suffix
    while (peek(ctx, 0) == 'u' || peek(ctx, 0) == 'U' ||
           peek(ctx, 0) == 'l' || peek(ctx, 0) == 'L' ||
           peek(ctx, 0) == 'f' || peek(ctx, 0) == 'F') {
        buf[i++] = advance(ctx);
    }
    buf[i] = '\0';
    return make_token(ctx, PPT_NUMBER, buf, line, col);
}

static PP_Token *read_identifier_token(PP_Context *ctx) {
    int line = ctx->line;
    int col = ctx->col;
    char buf[256];
    size_t i = 0;
    while (is_ident_char(peek(ctx, 0)) && i < sizeof(buf) - 1) {
        buf[i++] = advance(ctx);
    }
    buf[i] = '\0';
    return make_token(ctx, PPT_IDENTIFIER, buf, line, col);
}

static PP_Token *read_punct_token(PP_Context *ctx) {
    int line = ctx->line;
    int col = ctx->col;
    char c1 = advance(ctx);
    char c2 = peek(ctx, 0);
    char buf[4] = {c1, '\0', '\0', '\0'};
    // Three-char operators
    if (c1 == '<' && c2 == '<' && peek(ctx, 1) == '=') {
        buf[1] = advance(ctx); buf[2] = advance(ctx);
    } else if (c1 == '>' && c2 == '>' && peek(ctx, 1) == '=') {
        buf[1] = advance(ctx); buf[2] = advance(ctx);
    } else if (c1 == '.' && c2 == '.' && peek(ctx, 1) == '.') {
        buf[1] = advance(ctx); buf[2] = advance(ctx);
        return make_token(ctx, PPT_PUNCT, buf, line, col);
    }
    // Two-char operators
    else if ((c1 == '=' && c2 == '=') || (c1 == '!' && c2 == '=') ||
             (c1 == '<' && c2 == '=') || (c1 == '>' && c2 == '=') ||
             (c1 == '&' && c2 == '&') || (c1 == '|' && c2 == '|') ||
             (c1 == '+' && (c2 == '+' || c2 == '=')) ||
             (c1 == '-' && (c2 == '-' || c2 == '=' || c2 == '>')) ||
             (c1 == '*' && c2 == '=') || (c1 == '/' && c2 == '=') ||
             (c1 == '%' && c2 == '=') || (c1 == '&' && c2 == '=') ||
             (c1 == '|' && c2 == '=') || (c1 == '^' && c2 == '=') ||
             (c1 == '<' && c2 == '<') || (c1 == '>' && c2 == '>')) {
        buf[1] = advance(ctx);
    }
    if (buf[0] == '#') {
        return make_token(ctx, PPT_HASH, buf, line, col);
    }
    return make_token(ctx, PPT_PUNCT, buf, line, col);
}

static PP_Token *next_token(PP_Context *ctx) {
    while (true) {
        skip_whitespace_no_newline(ctx);

        // Skip line continuations (backslash + newline)
        while (peek(ctx, 0) == '\\' && peek(ctx, 1) == '\n') {
            advance(ctx); // '\'
            advance(ctx); // '\n'
            skip_whitespace_no_newline(ctx);
        }

        // Skip C++-style comments
        if (peek(ctx, 0) == '/' && peek(ctx, 1) == '/') {
            while (peek(ctx, 0) != '\n' && peek(ctx, 0) != '\0')
                advance(ctx);
            continue; // loop back to skip the newline and any following whitespace
        }

        // Skip C-style comments
        if (peek(ctx, 0) == '/' && peek(ctx, 1) == '*') {
            advance(ctx); // '/'
            advance(ctx); // '*'
            while (!(peek(ctx, 0) == '*' && peek(ctx, 1) == '/') && peek(ctx, 0) != '\0') {
                advance(ctx);
            }
            if (peek(ctx, 0) == '*') advance(ctx);
            if (peek(ctx, 0) == '/') advance(ctx);
            continue; // loop back
        }

        break;
    }

    char c = peek(ctx, 0);
    int line = ctx->line;
    int col = ctx->col;

    if (c == '\0') return make_token(ctx, PPT_EOF, "", line, col);
    if (c == '\n') {
        advance(ctx);
        return make_token(ctx, PPT_NEWLINE, "\n", line, col);
    }
    if (c == '"' || c == '\'') return read_string_token(ctx);
    if (isdigit(c)) return read_number_token(ctx);
    if (is_ident_start(c)) return read_identifier_token(ctx);
    if (is_punct_start(c)) return read_punct_token(ctx);

    // Unknown char
    char buf[2] = {c, '\0'};
    advance(ctx);
    return make_token(ctx, PPT_OTHER, buf, line, col);
}

Vector *pp_tokenize(PP_Context *ctx, const char *source) {
    ctx->src = source;
    ctx->src_len = strlen(source);
    ctx->pos = 0;
    ctx->line = 1;
    ctx->col = 1;

    Vector *tokens = vec_create();
    if (!tokens) return NULL;

    PP_Token *t;
    do {
        t = next_token(ctx);
        vec_push(tokens, t);
    } while (t->type != PPT_EOF);

    return tokens;
}

// ============================================================================
// Macro expansion
// ============================================================================

static PP_Macro *find_macro(PP_Context *ctx, const char *name) {
    return (PP_Macro *)ht_get(ctx->macros, name);
}

static bool is_macro_name(PP_Context *ctx, const char *name) {
    return ht_contains(ctx->macros, name);
}

// Collect arguments for a function-like macro invocation.
// tokens[i] is the identifier, tokens[i+1] should be '('.
// Returns a vector of vectors (each arg is a vector of tokens),
// or NULL if this is not a function-like invocation.
// Sets *end_idx to the token after ')'.
static Vector *collect_macro_args(PP_Context *ctx, Vector *tokens, int i, int *end_idx) {
    (void)ctx;
    int n = (int)tokens->len;
    if (i + 1 >= n) return NULL;
    PP_Token *next = vec_get(tokens, i + 1);
    if (!next || strcmp(next->text, "(") != 0) return NULL;

    Vector *args = vec_create();
    Vector *current_arg = vec_create();
    int depth = 1;
    int j = i + 2;
    while (j < n && depth > 0) {
        PP_Token *t = vec_get(tokens, j);
        if (strcmp(t->text, "(") == 0) {
            depth++;
            vec_push(current_arg, t);
        } else if (strcmp(t->text, ")") == 0) {
            depth--;
            if (depth == 0) break;
            vec_push(current_arg, t);
        } else if (strcmp(t->text, ",") == 0 && depth == 1) {
            vec_push(args, current_arg);
            current_arg = vec_create();
        } else {
            vec_push(current_arg, t);
        }
        j++;
    }
    vec_push(args, current_arg);
    *end_idx = j + 1; // after ')'
    return args;
}

// Expand a single macro invocation starting at tokens[i].
// Returns a new vector of tokens to replace tokens[i..end_idx-1].
static Vector *expand_macro_invocation(PP_Context *ctx, PP_Macro *macro,
                                        Vector *tokens, int i, int *end_idx) {
    Vector *result = vec_create();
    if (!macro->is_function) {
        // Object-like macro: just copy body
        for (int k = 0; k < macro->body_len; k++) {
            PP_Token *copy = arena_alloc(ctx->arena, sizeof(PP_Token));
            *copy = macro->body[k];
            copy->text = arena_strdup(ctx->arena, macro->body[k].text);
            vec_push(result, copy);
        }
        *end_idx = i + 1;
        return result;
    }

    // Function-like macro
    Vector *args = collect_macro_args(ctx, tokens, i, end_idx);
    if (!args) {
        // Not actually an invocation
        vec_push(result, vec_get(tokens, i));
        *end_idx = i + 1;
        return result;
    }

    // Map parameters to arguments
    HashTable *param_map = ht_create(16);
    int num_args = (int)args->len;
    for (int p = 0; p < macro->num_params; p++) {
        if (p < num_args) {
            ht_insert(param_map, macro->params[p], vec_get(args, p));
        } else {
            ht_insert(param_map, macro->params[p], NULL);
        }
    }
    if (macro->is_variadic) {
        // Combine remaining args into __VA_ARGS__
        if (macro->num_params <= num_args) {
            Vector *va = vec_create();
            for (int a = macro->num_params; a < num_args; a++) {
                Vector *arg = vec_get(args, a);
                for (size_t k = 0; k < arg->len; k++) {
                    vec_push(va, vec_get(arg, k));
                }
                if (a + 1 < num_args) {
                    PP_Token *comma = arena_alloc(ctx->arena, sizeof(PP_Token));
                    comma->type = PPT_PUNCT;
                    comma->text = ",";
                    vec_push(va, comma);
                }
            }
            ht_insert(param_map, "__VA_ARGS__", va);
        }
    }

    // Walk body and substitute
    for (int b = 0; b < macro->body_len; b++) {
        PP_Token *bt = &macro->body[b];
        if (bt->type == PPT_HASH && b + 1 < macro->body_len) {
            // Stringification
            PP_Token *next = &macro->body[b + 1];
            Vector *arg = ht_get(param_map, next->text);
            if (arg) {
                // Build string from arg tokens
                char buf[4096];
                buf[0] = '"';
                size_t pos = 1;
                for (size_t ai = 0; ai < arg->len; ai++) {
                    PP_Token *at = vec_get(arg, ai);
                    size_t tl = strlen(at->text);
                    if (pos + tl + 2 >= sizeof(buf)) break;
                    memcpy(buf + pos, at->text, tl);
                    pos += tl;
                }
                buf[pos++] = '"';
                buf[pos] = '\0';
                PP_Token *str = arena_alloc(ctx->arena, sizeof(PP_Token));
                str->type = PPT_STRING;
                str->text = arena_strdup(ctx->arena, buf);
                vec_push(result, str);
                b++;
                continue;
            }
        }
        if (bt->type == PPT_IDENTIFIER) {
            Vector *arg = ht_get(param_map, bt->text);
            if (arg) {
                for (size_t ai = 0; ai < arg->len; ai++) {
                    PP_Token *copy = arena_alloc(ctx->arena, sizeof(PP_Token));
                    PP_Token *orig = vec_get(arg, ai);
                    *copy = *orig;
                    copy->text = arena_strdup(ctx->arena, orig->text);
                    vec_push(result, copy);
                }
                continue;
            }
        }
        PP_Token *copy = arena_alloc(ctx->arena, sizeof(PP_Token));
        *copy = *bt;
        copy->text = arena_strdup(ctx->arena, bt->text);
        vec_push(result, copy);
    }

    ht_free(param_map);
    return result;
}

// Expand all macros in a token list.
// Returns a new vector.
static Vector *expand_all_macros(PP_Context *ctx, Vector *tokens) {
    Vector *result = vec_create();
    int i = 0;
    while (i < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, i);
        if (t->type == PPT_IDENTIFIER && is_macro_name(ctx, t->text)) {
            PP_Macro *m = find_macro(ctx, t->text);
            if (m) {
                int end;
                Vector *repl = expand_macro_invocation(ctx, m, tokens, i, &end);
                // Recursively expand the replacement
                Vector *expanded = expand_all_macros(ctx, repl);
                for (size_t k = 0; k < expanded->len; k++) {
                    vec_push(result, vec_get(expanded, k));
                }
                i = end;
                continue;
            }
        }
        vec_push(result, t);
        i++;
    }
    return result;
}

// ============================================================================
// Directive parsing helpers
// ============================================================================

// ============================================================================
// Directive handlers
// ============================================================================

static void handle_define(PP_Context *ctx, Vector *tokens, int *idx) {
    // *idx already points past 'define'
    if (*idx >= (int)tokens->len) return;
    PP_Token *name_tok = vec_get(tokens, *idx);
    if (name_tok->type != PPT_IDENTIFIER) return;
    char *name = name_tok->text;
    (*idx)++;

    PP_Macro *m = calloc(1, sizeof(PP_Macro));
    m->name = strdup(name);

    // Check for function-like macro
    if (*idx < (int)tokens->len) {
        PP_Token *next = vec_get(tokens, *idx);
        if (strcmp(next->text, "(") == 0 && next->col == name_tok->col + (int)strlen(name_tok->text)) {
            // Function-like
            m->is_function = true;
            (*idx)++; // skip '('
            // Read params until ')'
            Vector *params = vec_create();
            while (*idx < (int)tokens->len) {
                PP_Token *p = vec_get(tokens, *idx);
                if (strcmp(p->text, ")") == 0) {
                    (*idx)++;
                    break;
                }
                if (p->type == PPT_IDENTIFIER) {
                    if (strcmp(p->text, "__VA_ARGS__") == 0) {
                        m->is_variadic = true;
                    } else {
                        vec_push(params, arena_strdup(ctx->arena, p->text));
                    }
                    (*idx)++;
                } else if (strcmp(p->text, ",") == 0 || strcmp(p->text, "...") == 0) {
                    if (strcmp(p->text, "...") == 0) m->is_variadic = true;
                    (*idx)++;
                } else {
                    (*idx)++;
                }
            }
            m->num_params = (int)params->len;
            m->params = arena_alloc(ctx->arena, sizeof(char *) * m->num_params);
            for (int i = 0; i < m->num_params; i++) {
                m->params[i] = vec_get(params, i);
            }
            vec_free(params);
        }
    }

    // Read body until newline
    Vector *body = vec_create();
    while (*idx < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, *idx);
        if (t->type == PPT_NEWLINE || t->type == PPT_EOF) break;
        vec_push(body, t);
        (*idx)++;
    }
    m->body_len = (int)body->len;
    if (m->body_len > 0) {
        m->body = arena_alloc(ctx->arena, sizeof(PP_Token) * m->body_len);
        for (int i = 0; i < m->body_len; i++) {
            PP_Token *t = vec_get(body, i);
            m->body[i] = *t;
            m->body[i].text = arena_strdup(ctx->arena, t->text);
        }
    }
    vec_free(body);
    ht_insert(ctx->macros, name, m);
}

static void handle_undef(PP_Context *ctx, Vector *tokens, int *idx) {
    if (*idx >= (int)tokens->len) return;
    PP_Token *t = vec_get(tokens, *idx);
    if (t->type == PPT_IDENTIFIER) {
        ht_remove(ctx->macros, t->text);
    }
}

static char *read_file_contents(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = malloc(size + 1);
    if (!buf) {
        fclose(f);
        return NULL;
    }
    fread(buf, 1, size, f);
    buf[size] = '\0';
    fclose(f);
    return buf;
}

static char *resolve_include(PP_Context *ctx, const char *filename, bool is_system) {
    // System includes first if system
    if (is_system) {
        for (int i = 0; i < ctx->num_include_paths; i++) {
            char path[1024];
            snprintf(path, sizeof(path), "%s/%s", ctx->include_paths[i], filename);
            FILE *f = fopen(path, "r");
            if (f) { fclose(f); return strdup(path); }
        }
    }
    // Current directory first if local
    {
        FILE *f = fopen(filename, "r");
        if (f) { fclose(f); return strdup(filename); }
    }
    // Then include paths
    for (int i = 0; i < ctx->num_include_paths; i++) {
        char path[1024];
        snprintf(path, sizeof(path), "%s/%s", ctx->include_paths[i], filename);
        FILE *f = fopen(path, "r");
        if (f) { fclose(f); return strdup(path); }
    }
    return NULL;
}

static void preprocess_token_stream(PP_Context *ctx, Vector *tokens, Vector *output);

static void handle_include(PP_Context *ctx, Vector *tokens, int *idx,
                           Vector *output_tokens) {
    // *idx already points past 'include'
    if (*idx >= (int)tokens->len) return;
    PP_Token *t = vec_get(tokens, *idx);
    if (t->type != PPT_STRING) return;
    // Extract filename from quotes
    char filename[256];
    size_t len = strlen(t->text);
    if (len >= 2 && t->text[0] == '"' && t->text[len - 1] == '"') {
        memcpy(filename, t->text + 1, len - 2);
        filename[len - 2] = '\0';
    } else {
        strncpy(filename, t->text, sizeof(filename) - 1);
        filename[sizeof(filename) - 1] = '\0';
    }
    (*idx)++;

    char *path = resolve_include(ctx, filename, false);
    if (!path) return;

    if (ht_contains(ctx->included_files, path)) {
        free(path);
        return;
    }

    char *contents = read_file_contents(path);
    if (!contents) {
        free(path);
        return;
    }

    ht_insert(ctx->included_files, path, (void *)1);

    // Save context
    const char *old_src = ctx->src;
    size_t old_src_len = ctx->src_len;
    size_t old_pos = ctx->pos;
    int old_line = ctx->line;
    int old_col = ctx->col;
    char *old_filename = ctx->filename;

    // Tokenize included file
    Vector *inc_tokens = pp_tokenize(ctx, contents);
    free(contents);

    // Recursively preprocess the included file (directives + macro expansion)
    preprocess_token_stream(ctx, inc_tokens, output_tokens);

    // Restore context (but keep macro definitions)
    ctx->src = old_src;
    ctx->src_len = old_src_len;
    ctx->pos = old_pos;
    ctx->line = old_line;
    ctx->col = old_col;
    ctx->filename = old_filename;

    free(path);
}

static bool eval_defined(PP_Context *ctx, const char *name) {
    return ht_contains(ctx->macros, name);
}

// Very simple constant expression evaluator for #if/#elif.
// Supports integers, defined(NAME), &&, ||, !, ==, !=, <, >, <=, >=, +, -, *, /, %
static long eval_expr(PP_Context *ctx, Vector *tokens, int start, int end, int *consumed);

static long eval_primary(PP_Context *ctx, Vector *tokens, int *idx, int end) {
    if (*idx >= end) return 0;
    PP_Token *t = vec_get(tokens, *idx);
    if (t->type == PPT_NUMBER) {
        (*idx)++;
        return strtol(t->text, NULL, 0);
    }
    if (strcmp(t->text, "(") == 0) {
        (*idx)++;
        int start = *idx;
        long val = eval_expr(ctx, tokens, start, end, idx);
        if (*idx < end && strcmp(((PP_Token *)vec_get(tokens, *idx))->text, ")") == 0)
            (*idx)++;
        return val;
    }
    if (strcmp(t->text, "!") == 0) {
        (*idx)++;
        return !eval_primary(ctx, tokens, idx, end);
    }
    if (strcmp(t->text, "-") == 0) {
        (*idx)++;
        return -eval_primary(ctx, tokens, idx, end);
    }
    if (strcmp(t->text, "~") == 0) {
        (*idx)++;
        return ~eval_primary(ctx, tokens, idx, end);
    }
    if (strcmp(t->text, "defined") == 0) {
        (*idx)++;
        bool has_paren = false;
        if (*idx < end && strcmp(((PP_Token *)vec_get(tokens, *idx))->text, "(") == 0) {
            has_paren = true;
            (*idx)++;
        }
        if (*idx < end) {
            PP_Token *name = vec_get(tokens, *idx);
            if (name->type == PPT_IDENTIFIER) {
                (*idx)++;
                if (has_paren && *idx < end && strcmp(((PP_Token *)vec_get(tokens, *idx))->text, ")") == 0)
                    (*idx)++;
                return eval_defined(ctx, name->text) ? 1 : 0;
            }
        }
    }
    (*idx)++;
    return 0;
}

static long eval_expr(PP_Context *ctx, Vector *tokens, int start, int end, int *consumed) {
    int idx = start;
    // Simple left-to-right for now with basic precedence
    long lhs = eval_primary(ctx, tokens, &idx, end);
    while (idx < end) {
        PP_Token *op = vec_get(tokens, idx);
        if (strcmp(op->text, "&&") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs && rhs;
        } else if (strcmp(op->text, "||") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs || rhs;
        } else if (strcmp(op->text, "==") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs == rhs;
        } else if (strcmp(op->text, "!=") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs != rhs;
        } else if (strcmp(op->text, "<") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs < rhs;
        } else if (strcmp(op->text, ">") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs > rhs;
        } else if (strcmp(op->text, "<=") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs <= rhs;
        } else if (strcmp(op->text, ">=") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs >= rhs;
        } else if (strcmp(op->text, "+") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs + rhs;
        } else if (strcmp(op->text, "-") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs - rhs;
        } else if (strcmp(op->text, "*") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs * rhs;
        } else if (strcmp(op->text, "/") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = rhs != 0 ? lhs / rhs : 0;
        } else if (strcmp(op->text, "%") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = rhs != 0 ? lhs % rhs : 0;
        } else if (strcmp(op->text, "&") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs & rhs;
        } else if (strcmp(op->text, "|") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs | rhs;
        } else if (strcmp(op->text, "^") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs ^ rhs;
        } else if (strcmp(op->text, "<<") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs << rhs;
        } else if (strcmp(op->text, ">>") == 0) {
            idx++;
            long rhs = eval_primary(ctx, tokens, &idx, end);
            lhs = lhs >> rhs;
        } else {
            break;
        }
    }
    if (consumed) *consumed = idx;
    return lhs;
}

static void push_cond(PP_Context *ctx, bool val) {
    if (ctx->cond_depth >= ctx->cond_cap) {
        ctx->cond_cap *= 2;
        ctx->cond_stack = realloc(ctx->cond_stack, sizeof(bool) * ctx->cond_cap);
    }
    ctx->cond_stack[ctx->cond_depth++] = val;
    ctx->skipping = !val;
}

static void pop_cond(PP_Context *ctx) {
    if (ctx->cond_depth > 0) {
        ctx->cond_depth--;
        // After popping, recalculate skipping based on current top
        if (ctx->cond_depth > 0) {
            ctx->skipping = !ctx->cond_stack[ctx->cond_depth - 1];
        } else {
            ctx->skipping = false;
        }
    }
}

static void handle_ifdef(PP_Context *ctx, Vector *tokens, int *idx, bool is_ifdef) {
    // *idx already points past ifdef/ifndef
    if (*idx >= (int)tokens->len) { push_cond(ctx, false); return; }
    PP_Token *t = vec_get(tokens, *idx);
    if (t->type != PPT_IDENTIFIER) { push_cond(ctx, false); return; }
    bool defined = eval_defined(ctx, t->text);
    bool val = is_ifdef ? defined : !defined;
    push_cond(ctx, val);
    (*idx)++;
}

static void handle_if(PP_Context *ctx, Vector *tokens, int *idx) {
    // *idx already points past 'if'
    int start = *idx;
    while (*idx < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, *idx);
        if (t->type == PPT_NEWLINE || t->type == PPT_EOF) break;
        (*idx)++;
    }
    long val = eval_expr(ctx, tokens, start, *idx, NULL);
    push_cond(ctx, val != 0);
}

static void handle_elif(PP_Context *ctx, Vector *tokens, int *idx) {
    // *idx already points past 'elif'
    // If we were not skipping (previous branch was true), now skip
    if (ctx->cond_depth > 0 && ctx->cond_stack[ctx->cond_depth - 1]) {
        ctx->skipping = true;
        ctx->cond_stack[ctx->cond_depth - 1] = false; // mark this branch as taken
        // Skip to end of line
        while (*idx < (int)tokens->len) {
            PP_Token *t = vec_get(tokens, *idx);
            if (t->type == PPT_NEWLINE || t->type == PPT_EOF) break;
            (*idx)++;
        }
        return;
    }
    // If we were skipping, evaluate
    int start = *idx;
    while (*idx < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, *idx);
        if (t->type == PPT_NEWLINE || t->type == PPT_EOF) break;
        (*idx)++;
    }
    long val = eval_expr(ctx, tokens, start, *idx, NULL);
    if (val != 0) {
        ctx->skipping = false;
        if (ctx->cond_depth > 0)
            ctx->cond_stack[ctx->cond_depth - 1] = true;
    }
}

static void handle_else(PP_Context *ctx, int *idx) {
    (void)idx;
    if (ctx->cond_depth > 0) {
        // Toggle skipping: if previous was true, now skip; if false, now don't skip
        bool prev = ctx->cond_stack[ctx->cond_depth - 1];
        ctx->skipping = prev;
        if (!prev) ctx->cond_stack[ctx->cond_depth - 1] = true;
    }
}

static void handle_endif(PP_Context *ctx, int *idx) {
    (void)idx;
    pop_cond(ctx);
}

// ============================================================================
// Main preprocess entry point
// ============================================================================

static void preprocess_token_stream(PP_Context *ctx, Vector *tokens, Vector *output) {
    int i = 0;
    while (i < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, i);

        if (t->type == PPT_HASH) {
            // Check if this is a directive line
            // Look ahead for identifier after optional whitespace
            int j = i + 1;
            while (j < (int)tokens->len) {
                PP_Token *look = vec_get(tokens, j);
                if (look->type == PPT_WHITESPACE) { j++; continue; }
                if (look->type == PPT_NEWLINE) break;
                if (look->type == PPT_IDENTIFIER) {
                    char *name = look->text;
                    if (strcmp(name, "define") == 0) {
                        if (ctx->skipping) { i = j + 1; skip_to_eol(tokens, &i); break; }
                        i = j + 1;
                        handle_define(ctx, tokens, &i);
                        break;
                    } else if (strcmp(name, "undef") == 0) {
                        if (ctx->skipping) { i = j + 1; skip_to_eol(tokens, &i); break; }
                        i = j + 1;
                        handle_undef(ctx, tokens, &i);
                        break;
                    } else if (strcmp(name, "include") == 0) {
                        if (ctx->skipping) { i = j + 1; skip_to_eol(tokens, &i); break; }
                        i = j + 1;
                        handle_include(ctx, tokens, &i, output);
                        break;
                    } else if (strcmp(name, "ifdef") == 0) {
                        i = j + 1;
                        handle_ifdef(ctx, tokens, &i, true);
                        break;
                    } else if (strcmp(name, "ifndef") == 0) {
                        i = j + 1;
                        handle_ifdef(ctx, tokens, &i, false);
                        break;
                    } else if (strcmp(name, "if") == 0) {
                        i = j + 1;
                        handle_if(ctx, tokens, &i);
                        break;
                    } else if (strcmp(name, "elif") == 0) {
                        i = j + 1;
                        handle_elif(ctx, tokens, &i);
                        break;
                    } else if (strcmp(name, "else") == 0) {
                        i = j + 1;
                        handle_else(ctx, &i);
                        break;
                    } else if (strcmp(name, "endif") == 0) {
                        i = j + 1;
                        handle_endif(ctx, &i);
                        break;
                    } else {
                        // Unknown directive, skip
                        i = j + 1;
                        while (i < (int)tokens->len) {
                            PP_Token *nl = vec_get(tokens, i);
                            if (nl->type == PPT_NEWLINE || nl->type == PPT_EOF) break;
                            i++;
                        }
                        break;
                    }
                }
                break;
            }
            if (j >= (int)tokens->len || ((PP_Token *)vec_get(tokens, j))->type == PPT_NEWLINE) {
                i++;
            }
            continue;
        }

        if (ctx->skipping) {
            i++;
            continue;
        }

        if (t->type == PPT_NEWLINE) {
            // Collapse multiple newlines
            if (output->len > 0) {
                PP_Token *last = vec_get(output, output->len - 1);
                if (last->type == PPT_NEWLINE) {
                    i++;
                    continue;
                }
            }
        }

        // Expand macros on non-directive tokens
        if (t->type == PPT_IDENTIFIER && is_macro_name(ctx, t->text)) {
            PP_Macro *m = find_macro(ctx, t->text);
            if (m) {
                int end;
                Vector *repl = expand_macro_invocation(ctx, m, tokens, i, &end);
                Vector *expanded = expand_all_macros(ctx, repl);
                for (size_t k = 0; k < expanded->len; k++) {
                    PP_Token *et = vec_get(expanded, k);
                    if (et->type != PPT_EOF)
                        vec_push(output, et);
                }
                i = end;
                continue;
            }
        }

        vec_push(output, t);
        i++;
    }
}

char *preprocess(const char *source,
                 const char *filename,
                 const char **include_paths,
                 int num_include_paths,
                 const char **defines,
                 int num_defines) {
    PP_Context *ctx = make_context(include_paths, num_include_paths, defines, num_defines);
    if (!ctx) return NULL;
    ctx->filename = strdup(filename ? filename : "<input>");

    Vector *tokens = pp_tokenize(ctx, source);
    if (!tokens) {
        free_context(ctx);
        return NULL;
    }

    Vector *output = vec_create();
    preprocess_token_stream(ctx, tokens, output);

    // Serialize output tokens to string
    size_t buf_size = 4096;
    char *buf = malloc(buf_size);
    size_t pos = 0;
    for (size_t k = 0; k < output->len; k++) {
        PP_Token *ot = vec_get(output, k);
        if (ot->type == PPT_EOF) continue;
        size_t tl = strlen(ot->text);
        // Need space for text + possible space + newline handling
        if (pos + tl + 4 > buf_size) {
            buf_size *= 2;
            buf = realloc(buf, buf_size);
        }
        if (ot->type == PPT_NEWLINE) {
            buf[pos++] = '\n';
        } else {
            if (pos > 0 && buf[pos - 1] != '\n' && buf[pos - 1] != ' ') {
                // Add space between tokens if needed
                // But not before/after punctuation
                PP_Token *prev = k > 0 ? vec_get(output, k - 1) : NULL;
                bool need_space = true;
                if (prev && (prev->type == PPT_PUNCT || prev->type == PPT_HASH))
                    need_space = false;
                if (ot->type == PPT_PUNCT || ot->type == PPT_HASH)
                    need_space = false;
                if (need_space) buf[pos++] = ' ';
            }
            memcpy(buf + pos, ot->text, tl);
            pos += tl;
        }
    }
    buf[pos] = '\0';

    // Cleanup
    free(ctx->filename);
    free_context(ctx);
    vec_free(tokens);
    vec_free(output);

    return buf;
}

void pp_result_free(char *result) {
    free(result);
}

// Helper for skip_to_eol used in directive handling
static void skip_to_eol(Vector *tokens, int *idx) {
    while (*idx < (int)tokens->len) {
        PP_Token *t = vec_get(tokens, *idx);
        if (t->type == PPT_NEWLINE || t->type == PPT_EOF) break;
        (*idx)++;
    }
}
