#define _POSIX_C_SOURCE 200809L
#include "semantic.h"
#include "../preprocessor/arena.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ========================================================================
   Type system
   ======================================================================== */

const DataType TYPE_INT    = { BT_INT,    0, 0, NULL };
const DataType TYPE_CHAR   = { BT_CHAR,   0, 0, NULL };
const DataType TYPE_LONG   = { BT_LONG,   0, 0, NULL };
const DataType TYPE_FLOAT  = { BT_FLOAT,  0, 0, NULL };
const DataType TYPE_DOUBLE = { BT_DOUBLE, 0, 0, NULL };
const DataType TYPE_VOID   = { BT_VOID,   0, 0, NULL };

int types_equal(const DataType *a, const DataType *b) {
    if (!a || !b) return 0;
    if (a->base_type != b->base_type) return 0;
    if (a->is_pointer != b->is_pointer) return 0;
    if (a->pointer_count != b->pointer_count) return 0;
    if (a->base_type == BT_STRUCT) {
        if (!a->struct_name || !b->struct_name) return 0;
        if (strcmp(a->struct_name, b->struct_name) != 0) return 0;
    }
    return 1;
}

char *type_to_string(const DataType *t) {
    static char buf[256];
    if (!t) { strcpy(buf, "<null>"); return buf; }
    if (t->base_type == BT_STRUCT && t->struct_name) {
        snprintf(buf, sizeof(buf), "struct %s", t->struct_name);
    } else {
        const char *name = "unknown";
        switch (t->base_type) {
        case BT_INT:    name = "int"; break;
        case BT_CHAR:   name = "char"; break;
        case BT_LONG:   name = "long"; break;
        case BT_FLOAT:  name = "float"; break;
        case BT_DOUBLE: name = "double"; break;
        case BT_VOID:   name = "void"; break;
        case BT_STRUCT: name = "struct"; break;
        }
        strncpy(buf, name, sizeof(buf) - 1);
        buf[sizeof(buf) - 1] = '\0';
    }
    size_t len = strlen(buf);
    for (int i = 0; i < t->pointer_count && len + 1 < sizeof(buf); i++) {
        buf[len++] = '*';
    }
    buf[len] = '\0';
    return buf;
}

int is_numeric(const DataType *t) {
    if (!t || t->is_pointer) return 0;
    return t->base_type == BT_INT || t->base_type == BT_CHAR ||
           t->base_type == BT_LONG || t->base_type == BT_FLOAT ||
           t->base_type == BT_DOUBLE;
}

int is_floating_point(const DataType *t) {
    if (!t || t->is_pointer) return 0;
    return t->base_type == BT_FLOAT || t->base_type == BT_DOUBLE;
}

static DataType promoted_type(const DataType *left, const DataType *right) {
    if (left->base_type == BT_DOUBLE || right->base_type == BT_DOUBLE) return TYPE_DOUBLE;
    if (left->base_type == BT_FLOAT || right->base_type == BT_FLOAT) return TYPE_FLOAT;
    if (left->base_type == BT_LONG || right->base_type == BT_LONG) return TYPE_LONG;
    return TYPE_INT;
}

/* ========================================================================
   Symbol table (hash table with scope chains)
   ======================================================================== */

typedef struct SymbolEntry {
    char            *name;
    Symbol         **symbols;  /* array of symbols for this name (different scopes) */
    int              num_symbols;
    int              cap_symbols;
    struct SymbolEntry *next;
} SymbolEntry;

static unsigned long hash_str(const char *s) {
    unsigned long h = 5381;
    int c;
    while ((c = *s++)) h = ((h << 5) + h) + c;
    return h;
}

void symtab_init(SymbolTable *st) {
    st->cap = 256;
    st->buckets = calloc(st->cap, sizeof(SymbolEntry*));
    st->scope_level = 0;
}

void symtab_enter_scope(SymbolTable *st) {
    st->scope_level++;
}

void symtab_exit_scope(SymbolTable *st) {
    if (st->scope_level <= 0) return;
    /* Remove all symbols at current scope level */
    for (size_t i = 0; i < st->cap; i++) {
        SymbolEntry *e = st->buckets[i];
        SymbolEntry *prev = NULL;
        while (e) {
            int keep = 0;
            int new_count = 0;
            for (int j = 0; j < e->num_symbols; j++) {
                if (e->symbols[j]->scope_level != st->scope_level) {
                    e->symbols[new_count++] = e->symbols[j];
                    keep = 1;
                }
            }
            e->num_symbols = new_count;
            if (!keep) {
                /* Remove this entry entirely */
                SymbolEntry *next = e->next;
                free(e->symbols);
                free(e->name);
                free(e);
                if (prev) prev->next = next;
                else st->buckets[i] = next;
                e = next;
            } else {
                prev = e;
                e = e->next;
            }
        }
    }
    st->scope_level--;
}

int symtab_declare(SymbolTable *st, Symbol *sym) {
    unsigned long h = hash_str(sym->name) % st->cap;
    SymbolEntry *e = st->buckets[h];
    while (e) {
        if (strcmp(e->name, sym->name) == 0) break;
        e = e->next;
    }
    if (!e) {
        e = calloc(1, sizeof(SymbolEntry));
        e->name = strdup(sym->name);
        e->cap_symbols = 4;
        e->symbols = malloc(sizeof(Symbol*) * e->cap_symbols);
        e->next = st->buckets[h];
        st->buckets[h] = e;
    }
    /* Check for duplicate in current scope */
    for (int i = 0; i < e->num_symbols; i++) {
        if (e->symbols[i]->scope_level == st->scope_level) {
            /* Replace if existing was extern */
            if (e->symbols[i]->storage_class && strcmp(e->symbols[i]->storage_class, "extern") == 0) {
                e->symbols[i] = sym;
                return 1;
            }
            return 0; /* duplicate in current scope */
        }
    }
    if (e->num_symbols >= e->cap_symbols) {
        e->cap_symbols *= 2;
        e->symbols = realloc(e->symbols, sizeof(Symbol*) * e->cap_symbols);
    }
    e->symbols[e->num_symbols++] = sym;
    return 1;
}

Symbol *symtab_lookup(SymbolTable *st, const char *name) {
    unsigned long h = hash_str(name) % st->cap;
    SymbolEntry *e = st->buckets[h];
    while (e) {
        if (strcmp(e->name, name) == 0) {
            /* Return innermost matching symbol */
            Symbol *best = NULL;
            int best_level = -1;
            for (int i = 0; i < e->num_symbols; i++) {
                if (e->symbols[i]->scope_level <= st->scope_level &&
                    e->symbols[i]->scope_level > best_level) {
                    best = e->symbols[i];
                    best_level = e->symbols[i]->scope_level;
                }
            }
            return best;
        }
        e = e->next;
    }
    return NULL;
}

int symtab_get_scope_level(SymbolTable *st) {
    return st->scope_level;
}

void symtab_free(SymbolTable *st) {
    for (size_t i = 0; i < st->cap; i++) {
        SymbolEntry *e = st->buckets[i];
        while (e) {
            SymbolEntry *next = e->next;
            free(e->symbols);
            free(e->name);
            free(e);
            e = next;
        }
    }
    free(st->buckets);
}

/* ========================================================================
   Error list
   ======================================================================== */

void errorlist_init(ErrorList *el) {
    el->cap = 16;
    el->len = 0;
    el->errors = malloc(sizeof(SemanticError*) * el->cap);
}

void errorlist_add(ErrorList *el, const char *msg, int line, int col) {
    if (el->len >= el->cap) {
        el->cap *= 2;
        el->errors = realloc(el->errors, sizeof(SemanticError*) * el->cap);
    }
    SemanticError *err = malloc(sizeof(SemanticError));
    err->message = strdup(msg);
    err->line = line;
    err->column = col;
    el->errors[el->len++] = err;
}

void errorlist_free(ErrorList *el) {
    for (size_t i = 0; i < el->len; i++) {
        free(el->errors[i]->message);
        free(el->errors[i]);
    }
    free(el->errors);
    el->len = 0;
    el->cap = 0;
}

/* ========================================================================
   Type checker
   ======================================================================== */

typedef struct SigEntry {
    char            *name;
    FunctionSig      sig;
    struct SigEntry *next;
} SigEntry;

void tycheck_init(TypeChecker *tc) {
    tc->cap = 64;
    tc->len = 0;
    tc->sigs = calloc(tc->cap, sizeof(SigEntry*));
}

void tycheck_declare_function(TypeChecker *tc, FunctionSig *sig) {
    unsigned long h = hash_str(sig->name) % tc->cap;
    SigEntry *e = tc->sigs[h];
    while (e) {
        if (strcmp(e->name, sig->name) == 0) {
            e->sig = *sig;
            return;
        }
        e = e->next;
    }
    e = calloc(1, sizeof(SigEntry));
    e->name = strdup(sig->name);
    e->sig = *sig;
    e->next = tc->sigs[h];
    tc->sigs[h] = e;
}

FunctionSig *tycheck_lookup_function(TypeChecker *tc, const char *name) {
    if (!tc) return NULL;
    unsigned long h = hash_str(name) % tc->cap;
    SigEntry *e = tc->sigs[h];
    while (e) {
        if (strcmp(e->name, name) == 0) return &e->sig;
        e = e->next;
    }
    return NULL;
}

TypeCheckResult tycheck_compatible(TypeChecker *tc, const DataType *left, const DataType *right, const char *op) {
    (void)tc;
    TypeCheckResult res = { { BT_VOID, 0, 0, NULL }, 0, NULL };

    if (strcmp(op, "=") == 0) {
        if (types_equal(left, right)) {
            res.type = *left;
            return res;
        }
        if (is_numeric(left) && is_numeric(right)) {
            res.type = *left;
            return res;
        }
        if (left->base_type == BT_LONG && right->base_type == BT_INT && !right->is_pointer) {
            res.type = *left;
            return res;
        }
        /* void* to any pointer */
        if (left->is_pointer && right->is_pointer &&
            (left->base_type == BT_VOID || right->base_type == BT_VOID)) {
            res.type = *left;
            return res;
        }
        /* null pointer (0) to any pointer */
        if (left->is_pointer && right->base_type == BT_INT && !right->is_pointer) {
            res.type = *left;
            return res;
        }
        /* struct pointers */
        if (left->is_pointer && right->is_pointer &&
            left->base_type == BT_STRUCT && right->base_type == BT_STRUCT) {
            res.type = *left;
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Cannot assign %s to %s", type_to_string(right), type_to_string(left));
        res.error_message = buf;
        return res;
    }

    /* Arithmetic */
    if (strcmp(op, "+") == 0 || strcmp(op, "-") == 0 || strcmp(op, "*") == 0 ||
        strcmp(op, "/") == 0 || strcmp(op, "%") == 0) {
        if (is_numeric(left) && is_numeric(right)) {
            res.type = promoted_type(left, right);
            return res;
        }
        if (left->is_pointer && is_numeric(right) && !is_floating_point(right) &&
            (strcmp(op, "+") == 0 || strcmp(op, "-") == 0)) {
            res.type = *left;
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Invalid operands to '%s': %s and %s", op, type_to_string(left), type_to_string(right));
        res.error_message = buf;
        return res;
    }

    /* Bitwise */
    if (strcmp(op, "|") == 0 || strcmp(op, "&") == 0 || strcmp(op, "^") == 0 ||
        strcmp(op, "<<") == 0 || strcmp(op, ">>") == 0) {
        if (is_numeric(left) && is_numeric(right)) {
            res.type = promoted_type(left, right);
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Invalid operands to '%s': %s and %s", op, type_to_string(left), type_to_string(right));
        res.error_message = buf;
        return res;
    }

    /* Comparison */
    if (strcmp(op, "==") == 0 || strcmp(op, "!=") == 0 || strcmp(op, "<") == 0 ||
        strcmp(op, ">") == 0 || strcmp(op, "<=") == 0 || strcmp(op, ">=") == 0) {
        if (is_numeric(left) && is_numeric(right)) {
            res.type = TYPE_INT;
            return res;
        }
        if (types_equal(left, right) && left->base_type != BT_VOID) {
            res.type = TYPE_INT;
            return res;
        }
        if ((left->is_pointer && types_equal(right, &TYPE_INT)) ||
            (right->is_pointer && types_equal(left, &TYPE_INT))) {
            res.type = TYPE_INT;
            return res;
        }
        if (left->is_pointer && right->is_pointer) {
            res.type = TYPE_INT;
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Invalid comparison: %s and %s", type_to_string(left), type_to_string(right));
        res.error_message = buf;
        return res;
    }

    /* Logical */
    if (strcmp(op, "&&") == 0 || strcmp(op, "||") == 0 || strcmp(op, "!") == 0) {
        res.type = TYPE_INT;
        return res;
    }

    res.type = *left;
    return res;
}

TypeCheckResult tycheck_unary(TypeChecker *tc, const DataType *operand, const char *op) {
    (void)tc;
    TypeCheckResult res = { { BT_VOID, 0, 0, NULL }, 0, NULL };

    if (strcmp(op, "++") == 0 || strcmp(op, "--") == 0 || strcmp(op, "++_post") == 0 || strcmp(op, "--_post") == 0) {
        if (is_numeric(operand) || operand->is_pointer) {
            res.type = *operand;
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Cannot increment/decrement %s", type_to_string(operand));
        res.error_message = buf;
        return res;
    }

    if (strcmp(op, "!") == 0) {
        res.type = TYPE_INT;
        return res;
    }

    if (strcmp(op, "~") == 0 || strcmp(op, "-") == 0) {
        if (is_numeric(operand)) {
            res.type = *operand;
            return res;
        }
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Cannot apply '%s' to %s", op, type_to_string(operand));
        res.error_message = buf;
        return res;
    }

    res.type = *operand;
    return res;
}

TypeCheckResult tycheck_function_call(TypeChecker *tc, const char *name, DataType *arg_types, int num_args) {
    TypeCheckResult res = { { BT_VOID, 0, 0, NULL }, 0, NULL };
    FunctionSig *sig = tycheck_lookup_function(tc, name);
    if (!sig) {
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Function '%s' not declared", name);
        res.error_message = buf;
        return res;
    }

    if (sig->num_params != num_args) {
        res.type = sig->return_type;
        res.is_error = 1;
        static char buf[256];
        snprintf(buf, sizeof(buf), "Function '%s' expects %d args, got %d", name, sig->num_params, num_args);
        res.error_message = buf;
        return res;
    }

    for (int i = 0; i < num_args; i++) {
        if (!types_equal(sig->param_types[i], &arg_types[i])) {
            /* Allow 0 to pointer */
            if (sig->param_types[i]->is_pointer && types_equal(&arg_types[i], &TYPE_INT)) continue;
            /* Allow void* to any pointer */
            if (sig->param_types[i]->is_pointer && arg_types[i].is_pointer &&
                (sig->param_types[i]->base_type == BT_VOID || arg_types[i].base_type == BT_VOID)) continue;
            /* Allow numeric implicit conversions */
            if (is_numeric(sig->param_types[i]) && is_numeric(&arg_types[i])) continue;

            res.type = sig->return_type;
            res.is_error = 1;
            static char buf[256];
            snprintf(buf, sizeof(buf), "Param %d of '%s' expects %s, got %s",
                     i + 1, name, type_to_string(sig->param_types[i]), type_to_string(&arg_types[i]));
            res.error_message = buf;
            return res;
        }
    }

    res.type = sig->return_type;
    return res;
}

TypeCheckResult tycheck_valid_return(TypeChecker *tc, const DataType *expected, const DataType *actual) {
    (void)tc;
    TypeCheckResult res = { { BT_VOID, 0, 0, NULL }, 0, NULL };
    if (expected->base_type == BT_VOID && !expected->is_pointer) {
        if (actual->base_type == BT_VOID && !actual->is_pointer) return res;
    }
    if (types_equal(expected, actual)) return res;
    if (is_numeric(expected) && is_numeric(actual)) return res;
    if (expected->is_pointer && expected->base_type == BT_VOID && actual->is_pointer) return res;
    res.is_error = 1;
    return res;
}

void tycheck_free(TypeChecker *tc) {
    for (size_t i = 0; i < tc->cap; i++) {
        SigEntry *e = tc->sigs[i];
        while (e) {
            SigEntry *next = e->next;
            free(e->name);
            free(e->sig.param_types);
            free(e);
            e = next;
        }
    }
    free(tc->sigs);
}


/* ========================================================================
   Semantic analyzer (AST walker)
   ======================================================================== */

void sema_init(SemanticAnalyzer *sema) {
    symtab_init(&sema->symtab);
    errorlist_init(&sema->errors);
    tycheck_init(&sema->tycheck);
    sema->current_function = NULL;
}

void sema_free(SemanticAnalyzer *sema) {
    symtab_free(&sema->symtab);
    errorlist_free(&sema->errors);
    tycheck_free(&sema->tycheck);
}

static DataType parse_typespec(TypeSpec *ts);

static void add_error(SemanticAnalyzer *sema, const char *msg, int line, int col) {
    errorlist_add(&sema->errors, msg, line, col);
}

/* Forward declarations for recursive analysis */
static void analyze_program(SemanticAnalyzer *sema, ASTNode *node);
static void analyze_function_decl(SemanticAnalyzer *sema, ASTNode *node);
static void analyze_var_decl(SemanticAnalyzer *sema, ASTNode *node);
static void analyze_compound_stmt(SemanticAnalyzer *sema, ASTNode *node);
static void analyze_statement(SemanticAnalyzer *sema, ASTNode *node);
static DataType analyze_expression(SemanticAnalyzer *sema, ASTNode *node);

ErrorList sema_analyze(SemanticAnalyzer *sema, ASTNode *program) {
    /* Clear previous errors without freeing (caller owns cleanup) */
    sema->errors.len = 0;
    symtab_enter_scope(&sema->symtab);
    analyze_program(sema, program);
    symtab_exit_scope(&sema->symtab);
    return sema->errors;
}

static DataType parse_typespec(TypeSpec *ts) {
    if (!ts) return TYPE_INT;
    DataType dt = { BT_INT, ts->is_pointer, ts->pointer_count, NULL };
    if (ts->type_name) {
        if (strcmp(ts->type_name, "int") == 0) dt.base_type = BT_INT;
        else if (strcmp(ts->type_name, "char") == 0) dt.base_type = BT_CHAR;
        else if (strcmp(ts->type_name, "long") == 0) dt.base_type = BT_LONG;
        else if (strcmp(ts->type_name, "float") == 0) dt.base_type = BT_FLOAT;
        else if (strcmp(ts->type_name, "double") == 0) dt.base_type = BT_DOUBLE;
        else if (strcmp(ts->type_name, "void") == 0) dt.base_type = BT_VOID;
        else if (strncmp(ts->type_name, "struct ", 7) == 0) {
            dt.base_type = BT_STRUCT;
            dt.struct_name = strdup(ts->type_name + 7);
        }
    }
    return dt;
}

static void analyze_program(SemanticAnalyzer *sema, ASTNode *node) {
    if (node->type != NT_PROGRAM) return;

    /* First pass: declare all functions */
    for (int i = 0; i < node->u.program.ndecls; i++) {
        ASTNode *decl = node->u.program.decls[i];
        if (decl->type == NT_FUNCTION_DECL) {
            Symbol *sym = calloc(1, sizeof(Symbol));
            sym->name = decl->u.func.name;
            sym->type = parse_typespec(decl->u.func.ret_type);
            sym->kind = SYM_FUNCTION;
            sym->scope_level = symtab_get_scope_level(&sema->symtab);
            sym->line = decl->line;
            sym->column = decl->column;
            sym->return_type = malloc(sizeof(DataType));
            *sym->return_type = parse_typespec(decl->u.func.ret_type);
            /* Count non-anonymous parameters */
            int actual_params = 0;
            for (int j = 0; j < decl->u.func.nparam; j++) {
                if (decl->u.func.params[j]->u.param.name) actual_params++;
            }
            sym->num_params = actual_params;
            if (sym->num_params > 0) {
                sym->parameters = malloc(sizeof(Symbol*) * sym->num_params);
                int idx = 0;
                for (int j = 0; j < decl->u.func.nparam; j++) {
                    ASTNode *param = decl->u.func.params[j];
                    if (!param->u.param.name) continue;
                    Symbol *psym = calloc(1, sizeof(Symbol));
                    psym->name = param->u.param.name;
                    psym->type = parse_typespec(param->u.param.var_type);
                    psym->kind = SYM_PARAMETER;
                    psym->scope_level = symtab_get_scope_level(&sema->symtab);
                    sym->parameters[idx++] = psym;
                }
            }
            if (!symtab_declare(&sema->symtab, sym)) {
                static char buf[256];
                snprintf(buf, sizeof(buf), "Redeclaration of function '%s'", sym->name);
                add_error(sema, buf, decl->line, decl->column);
            }

            /* Register in type checker for call validation */
            FunctionSig sig;
            sig.name = sym->name;
            sig.return_type = *sym->return_type;
            sig.num_params = sym->num_params;
            sig.param_types = NULL;
            if (sig.num_params > 0) {
                sig.param_types = malloc(sizeof(DataType*) * sig.num_params);
                for (int j = 0; j < sig.num_params; j++) {
                    sig.param_types[j] = &sym->parameters[j]->type;
                }
            }
            tycheck_declare_function(&sema->tycheck, &sig);
        }
    }

    /* Second pass: analyze all declarations */
    for (int i = 0; i < node->u.program.ndecls; i++) {
        ASTNode *decl = node->u.program.decls[i];
        if (decl->type == NT_FUNCTION_DECL) {
            analyze_function_decl(sema, decl);
        } else if (decl->type == NT_DECLARATION) {
            analyze_var_decl(sema, decl);
        } else if (decl->type == NT_MULTI_DECLARATION) {
            for (int j = 0; j < decl->u.multi.ndecls; j++) {
                analyze_var_decl(sema, decl->u.multi.decls[j]);
            }
        } else {
            /* Top-level statement (e.g. return outside function) */
            analyze_statement(sema, decl);
        }
    }
}

static void analyze_function_decl(SemanticAnalyzer *sema, ASTNode *node) {
    ASTNode *prev_func = sema->current_function;
    sema->current_function = node;
    symtab_enter_scope(&sema->symtab);

    /* Declare parameters (skip anonymous void parameters like main(void)) */
    for (int i = 0; i < node->u.func.nparam; i++) {
        ASTNode *param = node->u.func.params[i];
        if (!param->u.param.name) continue; /* anonymous parameter, e.g. void */
        Symbol *sym = calloc(1, sizeof(Symbol));
        sym->name = param->u.param.name;
        sym->type = parse_typespec(param->u.param.var_type);
        sym->kind = SYM_PARAMETER;
        sym->scope_level = symtab_get_scope_level(&sema->symtab);
        sym->line = param->line;
        sym->column = param->column;
        if (!symtab_declare(&sema->symtab, sym)) {
            static char buf[256];
            snprintf(buf, sizeof(buf), "Duplicate parameter name '%s'", sym->name);
            add_error(sema, buf, param->line, param->column);
        }
    }

    /* Analyze body */
    if (node->u.func.body) {
        analyze_compound_stmt(sema, node->u.func.body);
    }

    symtab_exit_scope(&sema->symtab);
    sema->current_function = prev_func;
}

static void analyze_var_decl(SemanticAnalyzer *sema, ASTNode *node) {
    DataType var_type = parse_typespec(node->u.decl.var_type);
    Symbol *sym = calloc(1, sizeof(Symbol));
    sym->name = node->u.decl.name;
    sym->type = var_type;
    sym->kind = SYM_VARIABLE;
    sym->scope_level = symtab_get_scope_level(&sema->symtab);
    sym->line = node->line;
    sym->column = node->column;
    if (node->u.decl.storage) sym->storage_class = strdup(node->u.decl.storage);
    if (!symtab_declare(&sema->symtab, sym)) {
        static char buf[256];
        snprintf(buf, sizeof(buf), "Redeclaration of variable '%s'", sym->name);
        add_error(sema, buf, node->line, node->column);
    }

    /* Check initializer */
    if (node->u.decl.init) {
        size_t err_before = sema->errors.len;
        DataType init_type = analyze_expression(sema, node->u.decl.init);
        /* Suppress cascading type mismatch if expression already errored */
        if (sema->errors.len == err_before) {
            if (!types_equal(&var_type, &init_type)) {
                /* Allow some implicit conversions */
                int ok = 0;
                if (var_type.is_pointer && init_type.base_type == BT_INT && !init_type.is_pointer) ok = 1;
                if (var_type.base_type == BT_LONG && init_type.base_type == BT_INT && !init_type.is_pointer) ok = 1;
                if (var_type.is_pointer && init_type.is_pointer && init_type.base_type == BT_VOID) ok = 1;
                if (is_numeric(&var_type) && is_numeric(&init_type)) ok = 1;
                if (!ok) {
                    static char buf[256];
                    snprintf(buf, sizeof(buf), "Cannot initialize %s variable '%s' with %s",
                             type_to_string(&var_type), node->u.decl.name, type_to_string(&init_type));
                    add_error(sema, buf, node->line, node->column);
                }
            }
        }
    }
}

static void analyze_compound_stmt(SemanticAnalyzer *sema, ASTNode *node) {
    symtab_enter_scope(&sema->symtab);
    for (int i = 0; i < node->u.compound.nstmts; i++) {
        analyze_statement(sema, node->u.compound.stmts[i]);
    }
    symtab_exit_scope(&sema->symtab);
}

static void analyze_statement(SemanticAnalyzer *sema, ASTNode *node) {
    switch (node->type) {
    case NT_DECLARATION:
        analyze_var_decl(sema, node);
        break;
    case NT_MULTI_DECLARATION:
        for (int i = 0; i < node->u.multi.ndecls; i++) {
            analyze_var_decl(sema, node->u.multi.decls[i]);
        }
        break;
    case NT_ASSIGNMENT:
        analyze_expression(sema, node);
        break;
    case NT_IF_STMT:
        analyze_expression(sema, node->u.if_stmt.cond);
        analyze_statement(sema, node->u.if_stmt.then_br);
        if (node->u.if_stmt.else_br) analyze_statement(sema, node->u.if_stmt.else_br);
        break;
    case NT_WHILE_STMT:
        analyze_expression(sema, node->u.loop.cond);
        analyze_statement(sema, node->u.loop.body);
        break;
    case NT_FOR_STMT:
        if (node->u.for_stmt.init) {
            if (node->u.for_stmt.init->type == NT_DECLARATION)
                analyze_var_decl(sema, node->u.for_stmt.init);
            else
                analyze_expression(sema, node->u.for_stmt.init);
        }
        if (node->u.for_stmt.cond) analyze_expression(sema, node->u.for_stmt.cond);
        if (node->u.for_stmt.incr) analyze_expression(sema, node->u.for_stmt.incr);
        analyze_statement(sema, node->u.for_stmt.body);
        break;
    case NT_RETURN_STMT:
        if (!sema->current_function) {
            add_error(sema, "Return statement outside of function", node->line, node->column);
            break;
        }
        DataType expected = parse_typespec(sema->current_function->u.func.ret_type);
        if (node->u.ret.value) {
            size_t err_before = sema->errors.len;
            DataType actual = analyze_expression(sema, node->u.ret.value);
            /* Suppress cascading return-type error if expression already errored */
            if (sema->errors.len == err_before) {
                TypeCheckResult res = tycheck_valid_return(&sema->tycheck, &expected, &actual);
                if (res.is_error) {
                    static char buf[256];
                    snprintf(buf, sizeof(buf), "Function '%s' expects to return %s, but got %s",
                             sema->current_function->u.func.name, type_to_string(&expected), type_to_string(&actual));
                    add_error(sema, buf, node->line, node->column);
                }
            }
        } else {
            if (expected.base_type != BT_VOID || expected.is_pointer) {
                static char buf[256];
                snprintf(buf, sizeof(buf), "Function '%s' expects to return %s, but got no value",
                         sema->current_function->u.func.name, type_to_string(&expected));
                add_error(sema, buf, node->line, node->column);
            }
        }
        break;
    case NT_EXPR_STMT:
        analyze_expression(sema, node->u.expr_stmt.expr);
        break;
    case NT_COMPOUND_STMT:
        analyze_compound_stmt(sema, node);
        break;
    case NT_BREAK_STMT:
    case NT_CONTINUE_STMT:
    case NT_EMPTY_STMT:
        break;
    default:
        break;
    }
}

static DataType analyze_expression(SemanticAnalyzer *sema, ASTNode *node) {
    switch (node->type) {
    case NT_NUMBER_LIT: {
        const char *val = node->u.number.value;
        if (strchr(val, '.') || strchr(val, 'e') || strchr(val, 'E')) return TYPE_DOUBLE;
        if (val[strlen(val)-1] == 'f' || val[strlen(val)-1] == 'F') return TYPE_FLOAT;
        if (val[strlen(val)-1] == 'l' || val[strlen(val)-1] == 'L') return TYPE_LONG;
        return TYPE_INT;
    }
    case NT_STRING_LIT:
        return (DataType){ BT_CHAR, 1, 1, NULL };
    case NT_CHAR_LIT:
        return TYPE_CHAR;
    case NT_IDENTIFIER: {
        Symbol *sym = symtab_lookup(&sema->symtab, node->u.ident.name);
        if (!sym) {
            /* Allow UPPER_CASE as enum constants */
            int is_enum = 1;
            for (const char *p = node->u.ident.name; *p; p++) {
                if (!((*p >= 'A' && *p <= 'Z') || (*p >= '0' && *p <= '9') || *p == '_')) {
                    is_enum = 0; break;
                }
            }
            if (is_enum && node->u.ident.name[0] >= 'A' && node->u.ident.name[0] <= 'Z') {
                return TYPE_INT;
            }
            static char buf[256];
            snprintf(buf, sizeof(buf), "Undeclared identifier '%s'", node->u.ident.name);
            add_error(sema, buf, node->line, node->column);
            return TYPE_VOID;
        }
        return sym->type;
    }
    case NT_BINARY_EXPR: {
        size_t err_before = sema->errors.len;
        DataType left = analyze_expression(sema, node->u.binary.left);
        DataType right = analyze_expression(sema, node->u.binary.right);
        /* Suppress cascading binary-op errors if sub-expressions already errored */
        if (sema->errors.len == err_before) {
            TypeCheckResult res = tycheck_compatible(&sema->tycheck, &left, &right, node->u.binary.op);
            if (res.is_error && res.error_message) {
                add_error(sema, res.error_message, node->line, node->column);
            }
            return res.type;
        }
        /* If sub-expression errored, return a sensible fallback type */
        if (left.base_type != BT_VOID && !left.is_pointer) return left;
        if (right.base_type != BT_VOID && !right.is_pointer) return right;
        return TYPE_INT;
    }
    case NT_UNARY_EXPR: {
        DataType operand = analyze_expression(sema, node->u.unary.operand);
        if (strcmp(node->u.unary.op, "&") == 0) {
            DataType res = operand;
            res.is_pointer = 1;
            res.pointer_count++;
            return res;
        }
        if (strcmp(node->u.unary.op, "*") == 0) {
            if (!operand.is_pointer) {
                static char buf[256];
                snprintf(buf, sizeof(buf), "Cannot dereference non-pointer type %s", type_to_string(&operand));
                add_error(sema, buf, node->line, node->column);
                return TYPE_VOID;
            }
            DataType res = operand;
            res.pointer_count--;
            if (res.pointer_count <= 0) res.is_pointer = 0;
            return res;
        }
        TypeCheckResult res = tycheck_unary(&sema->tycheck, &operand, node->u.unary.op);
        if (res.is_error && res.error_message) {
            add_error(sema, res.error_message, node->line, node->column);
        }
        return res.type;
    }
    case NT_ASSIGNMENT: {
        DataType target = analyze_expression(sema, node->u.assign.target);
        DataType value = analyze_expression(sema, node->u.assign.value);
        TypeCheckResult res = tycheck_compatible(&sema->tycheck, &target, &value, "=");
        if (res.is_error && res.error_message) {
            add_error(sema, res.error_message, node->line, node->column);
        }
        return target;
    }
    case NT_FUNCTION_CALL: {
        DataType *arg_types = NULL;
        int num_args = node->u.call.nargs;
        if (num_args > 0) {
            arg_types = malloc(sizeof(DataType) * num_args);
            for (int i = 0; i < num_args; i++) {
                arg_types[i] = analyze_expression(sema, node->u.call.args[i]);
            }
        }
        char *func_name = NULL;
        if (node->u.call.callee->type == NT_IDENTIFIER) {
            func_name = node->u.call.callee->u.ident.name;
        }
        if (func_name) {
            TypeCheckResult res = tycheck_function_call(&sema->tycheck, func_name, arg_types, num_args);
            if (res.is_error && res.error_message) {
                add_error(sema, res.error_message, node->line, node->column);
            }
            free(arg_types);
            return res.type;
        }
        free(arg_types);
        return TYPE_INT;
    }
    case NT_SIZEOF_EXPR:
        return TYPE_INT;
    case NT_CAST_EXPR:
        return parse_typespec(node->u.cast.target_type);
    case NT_MEMBER_ACCESS: {
        DataType obj = analyze_expression(sema, node->u.member.object);
        if (obj.is_pointer && obj.base_type == BT_STRUCT && obj.struct_name) {
            return (DataType){ BT_STRUCT, 1, 1, obj.struct_name };
        }
        return TYPE_INT;
    }
    case NT_ARRAY_ACCESS:
        analyze_expression(sema, node->u.arr.array);
        analyze_expression(sema, node->u.arr.index);
        return TYPE_INT;
    case NT_TERNARY_EXPR:
        analyze_expression(sema, node->u.ternary.cond);
        analyze_expression(sema, node->u.ternary.then_expr);
        analyze_expression(sema, node->u.ternary.else_expr);
        return TYPE_INT;
    case NT_POSTFIX_EXPR:
        return analyze_expression(sema, node->u.postfix.operand);
    default:
        return TYPE_INT;
    }
}
