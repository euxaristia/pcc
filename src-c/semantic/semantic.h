#ifndef SEMANTIC_H
#define SEMANTIC_H

#include "../parser/parser.h"

/* ========================================================================
   Type system
   ======================================================================== */

typedef enum {
    BT_INT,
    BT_CHAR,
    BT_LONG,
    BT_FLOAT,
    BT_DOUBLE,
    BT_VOID,
    BT_STRUCT,
} BaseType;

typedef struct DataType {
    BaseType base_type;
    int      is_pointer;
    int      pointer_count;
    char    *struct_name;  /* NULL if not struct */
} DataType;

/* Built-in type constants */
extern const DataType TYPE_INT;
extern const DataType TYPE_CHAR;
extern const DataType TYPE_LONG;
extern const DataType TYPE_FLOAT;
extern const DataType TYPE_DOUBLE;
extern const DataType TYPE_VOID;

int types_equal(const DataType *a, const DataType *b);
char *type_to_string(const DataType *t);
int is_numeric(const DataType *t);
int is_floating_point(const DataType *t);

/* ========================================================================
   Symbols
   ======================================================================== */

typedef enum {
    SYM_VARIABLE,
    SYM_FUNCTION,
    SYM_PARAMETER,
} SymbolKind;

typedef struct Symbol {
    char        *name;
    DataType     type;
    SymbolKind   kind;
    int          scope_level;
    int          line;
    int          column;
    DataType    *return_type;   /* for functions */
    struct Symbol **parameters; /* for functions */
    int          num_params;
    char        *storage_class;
} Symbol;

/* ========================================================================
   Symbol table (scoped)
   ======================================================================== */

typedef struct SymbolTable {
    struct SymbolEntry **buckets;
    size_t               cap;
    int                  scope_level;
} SymbolTable;

void        symtab_init(SymbolTable *st);
void        symtab_enter_scope(SymbolTable *st);
void        symtab_exit_scope(SymbolTable *st);
int         symtab_declare(SymbolTable *st, Symbol *sym);
Symbol     *symtab_lookup(SymbolTable *st, const char *name);
int         symtab_get_scope_level(SymbolTable *st);
void        symtab_free(SymbolTable *st);

/* ========================================================================
   Semantic errors
   ======================================================================== */

typedef struct SemanticError {
    char *message;
    int   line;
    int   column;
} SemanticError;

typedef struct ErrorList {
    SemanticError **errors;
    size_t          len;
    size_t          cap;
} ErrorList;

void errorlist_init(ErrorList *el);
void errorlist_add(ErrorList *el, const char *msg, int line, int col);
void errorlist_free(ErrorList *el);

/* ========================================================================
   Type checker
   ======================================================================== */

typedef struct TypeCheckResult {
    DataType type;
    int      is_error;
    char    *error_message;
} TypeCheckResult;

typedef struct FunctionSig {
    char        *name;
    DataType     return_type;
    DataType   **param_types;
    int          num_params;
} FunctionSig;

typedef struct TypeChecker {
    struct SigEntry **sigs;
    size_t            cap;
    size_t            len;
} TypeChecker;

/* ========================================================================
   Semantic analyzer
   ======================================================================== */

typedef struct SemanticAnalyzer {
    SymbolTable  symtab;
    ErrorList    errors;
    TypeChecker  tycheck;
    ASTNode     *current_function; /* NT_FUNCTION_DECL or NULL */
} SemanticAnalyzer;

void sema_init(SemanticAnalyzer *sema);
void sema_free(SemanticAnalyzer *sema);

/* Main entry point */
ErrorList sema_analyze(SemanticAnalyzer *sema, ASTNode *program);

void           tycheck_init(TypeChecker *tc);
void           tycheck_declare_function(TypeChecker *tc, FunctionSig *sig);
FunctionSig   *tycheck_lookup_function(TypeChecker *tc, const char *name);
TypeCheckResult tycheck_compatible(TypeChecker *tc, const DataType *left, const DataType *right, const char *op);
TypeCheckResult tycheck_unary(TypeChecker *tc, const DataType *operand, const char *op);
TypeCheckResult tycheck_function_call(TypeChecker *tc, const char *name, DataType *arg_types, int num_args);
TypeCheckResult tycheck_valid_return(TypeChecker *tc, const DataType *expected, const DataType *actual);
void           tycheck_free(TypeChecker *tc);

#endif /* SEMANTIC_H */
