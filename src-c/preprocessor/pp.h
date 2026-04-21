#ifndef PP_H
#define PP_H

#include <stddef.h>
#include <stdbool.h>

// Forward declarations
typedef struct Arena Arena;
typedef struct Vector Vector;
typedef struct HashTable HashTable;

// Preprocessor token types.
typedef enum {
    PPT_EOF,
    PPT_NEWLINE,
    PPT_WHITESPACE,
    PPT_IDENTIFIER,
    PPT_NUMBER,
    PPT_STRING,
    PPT_CHAR_LITERAL,
    PPT_PUNCT,       // operators, punctuation
    PPT_HASH,        // #
    PPT_DOUBLE_HASH, // ##
    PPT_OTHER,
} PP_TokenType;

// A single preprocessor token.
typedef struct PP_Token {
    PP_TokenType type;
    char *text;      // null-terminated, owned by arena
    int line;
    int col;
} PP_Token;

// A macro definition.
typedef struct PP_Macro {
    char *name;
    bool is_function;    // true if function-like
    bool is_variadic;    // true if uses __VA_ARGS__
    char **params;       // parameter names (NULL for object-like)
    int num_params;
    PP_Token *body;      // token sequence
    int body_len;
} PP_Macro;

// Preprocessor state/context.
typedef struct PP_Context {
    Arena *arena;
    HashTable *macros;       // name -> PP_Macro*
    char **include_paths;
    int num_include_paths;
    // Conditional stack
    bool *cond_stack;
    int cond_depth;
    int cond_cap;
    bool skipping;           // currently skipping false branch
    // Included files guard
    HashTable *included_files;
    // Current location for #line
    char *filename;
    int line;
    int col;
    // Source position
    const char *src;
    size_t src_len;
    size_t pos;
} PP_Context;

// Main entry point.
// Returns a freshly allocated string (must be freed by caller) containing
// the fully preprocessed source, or NULL on error.
char *preprocess(const char *source,
                 const char *filename,
                 const char **include_paths,
                 int num_include_paths,
                 const char **defines,
                 int num_defines);

// Tokenize a source string into a vector of PP_Token*.
Vector *pp_tokenize(PP_Context *ctx, const char *source);

// Free the result of preprocess().
void pp_result_free(char *result);

#endif // PP_H
