#define _POSIX_C_SOURCE 200809L
#include "irgen.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ========================================================================
   Context
   ======================================================================== */

typedef struct ValueMapEntry {
    char               *name;
    void               *value;
    struct ValueMapEntry *next;
} ValueMapEntry;

typedef struct IRGenerator {
    IRModule          *module;
    IRFunction        *current_function;
    IRBlock           *current_block;
    int                next_id;
    int                label_counter;
    ValueMapEntry     *value_map[256];
} IRGenerator;

/* ========================================================================
   Internal helpers
   ======================================================================== */

static unsigned int hash_name(const char *s) {
    unsigned int h = 5381;
    int c;
    while ((c = *s++)) h = ((h << 5) + h) + c;
    return h % 256;
}

static void value_map_set(IRGenerator *gen, const char *name, void *value) {
    unsigned int h = hash_name(name);
    ValueMapEntry *e = gen->value_map[h];
    while (e) {
        if (strcmp(e->name, name) == 0) {
            e->value = value;
            return;
        }
        e = e->next;
    }
    e = calloc(1, sizeof(ValueMapEntry));
    e->name = strdup(name);
    e->value = value;
    e->next = gen->value_map[h];
    gen->value_map[h] = e;
}

static void *value_map_get(IRGenerator *gen, const char *name) {
    unsigned int h = hash_name(name);
    ValueMapEntry *e = gen->value_map[h];
    while (e) {
        if (strcmp(e->name, name) == 0) return e->value;
        e = e->next;
    }
    return NULL;
}

static void value_map_clear(IRGenerator *gen) {
    for (int i = 0; i < 256; i++) {
        ValueMapEntry *e = gen->value_map[i];
        while (e) {
            ValueMapEntry *next = e->next;
            free(e->name);
            free(e);
            e = next;
        }
        gen->value_map[i] = NULL;
    }
}

static char *gen_id(IRGenerator *gen) {
    static char buf[32];
    snprintf(buf, sizeof(buf), "t%d", gen->next_id++);
    return strdup(buf);
}

static char *gen_label(IRGenerator *gen, const char *prefix) {
    static char buf[64];
    snprintf(buf, sizeof(buf), "%s_%d", prefix, gen->label_counter++);
    return strdup(buf);
}

static IRBlock *create_block(const char *label) {
    IRBlock *b = calloc(1, sizeof(IRBlock));
    b->label = strdup(label);
    return b;
}

/* ========================================================================
   Type conversion
   ======================================================================== */

static IRType ast_type_to_ir(TypeSpec *ts) {
    if (!ts) return IR_I32;
    if (ts->is_pointer) return IR_PTR;
    if (!ts->type_name) return IR_I32;
    if (strcmp(ts->type_name, "int") == 0) return IR_I32;
    if (strcmp(ts->type_name, "char") == 0) return IR_I8;
    if (strcmp(ts->type_name, "long") == 0) return IR_I64;
    if (strcmp(ts->type_name, "float") == 0) return IR_F32;
    if (strcmp(ts->type_name, "double") == 0) return IR_F64;
    if (strcmp(ts->type_name, "void") == 0) return IR_VOID;
    return IR_I32;
}

static IRType get_result_type(IROpCode op, IRType left, IRType right) {
    (void)op;
    if (left == IR_F64 || right == IR_F64) return IR_F64;
    if (left == IR_F32 || right == IR_F32) return IR_F32;
    if (left == IR_I64 || right == IR_I64) return IR_I64;
    if (op >= IR_OP_EQ && op <= IR_OP_GE) return IR_I32;
    if (op == IR_OP_AND || op == IR_OP_OR) return IR_I32;
    return IR_I32;
}

/* ========================================================================
   Forward declarations
   ======================================================================== */

static void process_statement(IRGenerator *gen, ASTNode *stmt);
static void *process_expression(IRGenerator *gen, ASTNode *expr);

/* ========================================================================
   Globals
   ======================================================================== */

static void process_global_declaration(IRGenerator *gen, ASTNode *decl) {
    IRGlobal *g = calloc(1, sizeof(IRGlobal));
    g->name = strdup(decl->u.decl.name);
    g->type = ast_type_to_ir(decl->u.decl.var_type);
    
    if (decl->u.decl.init) {
        if (decl->u.decl.init->type == NT_NUMBER_LIT) {
            g->initializer = ir_create_constant(atof(decl->u.decl.init->u.number.value), g->type);
        }
    }
    
    ir_module_add_global(gen->module, g);
}

/* ========================================================================
   Function declarations
   ======================================================================== */

static void process_function_declaration(IRGenerator *gen, ASTNode *func) {
    IRFunction *f = calloc(1, sizeof(IRFunction));
    f->name = strdup(func->u.func.name);
    f->return_type = ast_type_to_ir(func->u.func.ret_type);
    
    /* Parameters - skip anonymous void parameters like main(void) */
    int actual_params = 0;
    for (int i = 0; i < func->u.func.nparam; i++) {
        ASTNode *p = func->u.func.params[i];
        if (p->u.param.name) actual_params++;
    }
    f->num_params = actual_params;
    if (f->num_params > 0) {
        f->params = calloc(f->num_params, sizeof(IRParam));
        int idx = 0;
        for (int i = 0; i < func->u.func.nparam; i++) {
            ASTNode *p = func->u.func.params[i];
            if (!p->u.param.name) continue;
            f->params[idx].name = strdup(p->u.param.name);
            f->params[idx].type = ast_type_to_ir(p->u.param.var_type);
            idx++;
        }
    }
    
    gen->current_function = f;
    value_map_clear(gen);
    
    /* Entry block */
    IRBlock *entry = create_block("entry_0");
    ir_function_add_block(f, entry);
    gen->current_block = entry;
    
    /* Store parameters to stack */
    for (int i = 0; i < f->num_params; i++) {
        IRValue *param_val = ir_create_value(f->params[i].name, f->params[i].type);
        IRInstruction *alloca = ir_create_instruction(gen_id(gen), IR_OP_ALLOCA, f->params[i].type);
        ir_block_add_instr(entry, alloca);
        
        IRInstruction *store = ir_create_instruction(gen_id(gen), IR_OP_STORE, IR_VOID);
        store->num_operands = 2;
        store->operands = calloc(2, sizeof(void*));
        store->operands[0] = param_val;
        store->operands[1] = alloca;
        ir_block_add_instr(entry, store);
        
        value_map_set(gen, f->params[i].name, alloca);
    }
    
    /* Process body */
    if (func->u.func.body) {
        process_statement(gen, func->u.func.body);
    }
    
    ir_module_add_function(gen->module, f);
    gen->current_function = NULL;
    gen->current_block = NULL;
}

/* ========================================================================
   Statements
   ======================================================================== */

static void process_variable_declaration(IRGenerator *gen, ASTNode *decl) {
    if (!gen->current_function || !gen->current_block) return;
    
    IRType var_type = ast_type_to_ir(decl->u.decl.var_type);
    IRInstruction *alloca = ir_create_instruction(gen_id(gen), IR_OP_ALLOCA, var_type);
    ir_block_add_instr(gen->current_block, alloca);
    
    value_map_set(gen, decl->u.decl.name, alloca);
    
    if (decl->u.decl.init) {
        void *init_val = process_expression(gen, decl->u.decl.init);
        IRInstruction *store = ir_create_instruction(gen_id(gen), IR_OP_STORE, IR_VOID);
        store->num_operands = 2;
        store->operands = calloc(2, sizeof(void*));
        store->operands[0] = init_val;
        store->operands[1] = alloca;
        ir_block_add_instr(gen->current_block, store);
    }
    
    ir_function_add_local(gen->current_function, decl->u.decl.name, var_type);
}

static void process_assignment(IRGenerator *gen, ASTNode *assign) {
    if (!gen->current_block) return;
    
    void *target_addr = NULL;
    ASTNode *target = assign->u.assign.target;
    
    if (target->type == NT_IDENTIFIER) {
        target_addr = value_map_get(gen, target->u.ident.name);
        if (!target_addr) {
            /* Check global */
            for (int i = 0; i < gen->module->num_globals; i++) {
                if (strcmp(gen->module->globals[i]->name, target->u.ident.name) == 0) {
                    target_addr = ir_create_value(target->u.ident.name, IR_PTR);
                    break;
                }
            }
        }
    } else if (target->type == NT_UNARY_EXPR && strcmp(target->u.unary.op, "*") == 0) {
        target_addr = process_expression(gen, target->u.unary.operand);
    } else if (target->type == NT_ARRAY_ACCESS) {
        /* Simplified: just get the array base */
        ASTNode *arr = target->u.arr.array;
        if (arr->type == NT_IDENTIFIER) {
            target_addr = value_map_get(gen, arr->u.ident.name);
            if (!target_addr) {
                for (int i = 0; i < gen->module->num_globals; i++) {
                    if (strcmp(gen->module->globals[i]->name, arr->u.ident.name) == 0) {
                        target_addr = ir_create_value(arr->u.ident.name, IR_PTR);
                        break;
                    }
                }
            }
        }
        if (!target_addr) {
            target_addr = process_expression(gen, arr);
        }
    }
    
    if (!target_addr) return;
    
    void *value = process_expression(gen, assign->u.assign.value);
    IRInstruction *store = ir_create_instruction(gen_id(gen), IR_OP_STORE, IR_VOID);
    store->num_operands = 2;
    store->operands = calloc(2, sizeof(void*));
    store->operands[0] = value;
    store->operands[1] = target_addr;
    ir_block_add_instr(gen->current_block, store);
}

static IRValue *ensure_value(IRGenerator *gen, void *expr) {
    IRValue *v = expr;
    if (!v->is_constant) return v;
    /* Convert constant to MOV instruction */
    IRConstant *c = expr;
    IRInstruction *mov = ir_create_instruction(gen_id(gen), IR_OP_MOV, c->type);
    mov->num_operands = 1;
    mov->operands = calloc(1, sizeof(void*));
    mov->operands[0] = c;
    ir_block_add_instr(gen->current_block, mov);
    return (IRValue*)mov;
}

static void process_if_statement(IRGenerator *gen, ASTNode *stmt) {
    if (!gen->current_function || !gen->current_block) return;
    
    void *cond = process_expression(gen, stmt->u.if_stmt.cond);
    IRValue *cond_val = ensure_value(gen, cond);
    
    IRBlock *then_block = create_block(gen_label(gen, "then"));
    IRBlock *else_block = stmt->u.if_stmt.else_br ? create_block(gen_label(gen, "else")) : NULL;
    IRBlock *merge_block = create_block(gen_label(gen, "merge"));
    
    IRJumpIf *jump_if = ir_create_jump_if(cond_val, then_block->label,
                                           else_block ? else_block->label : merge_block->label);
    ir_block_add_instr(gen->current_block, jump_if);
    
    /* Then */
    ir_function_add_block(gen->current_function, then_block);
    gen->current_block = then_block;
    process_statement(gen, stmt->u.if_stmt.then_br);
    if (gen->current_block) {
        ir_block_add_instr(gen->current_block, ir_create_jump(merge_block->label));
    }
    
    /* Else */
    if (else_block && stmt->u.if_stmt.else_br) {
        ir_function_add_block(gen->current_function, else_block);
        gen->current_block = else_block;
        process_statement(gen, stmt->u.if_stmt.else_br);
        if (gen->current_block) {
            ir_block_add_instr(gen->current_block, ir_create_jump(merge_block->label));
        }
    }
    
    /* Merge */
    ir_function_add_block(gen->current_function, merge_block);
    gen->current_block = merge_block;
}

static void process_while_statement(IRGenerator *gen, ASTNode *stmt) {
    if (!gen->current_function || !gen->current_block) return;
    
    IRBlock *cond_block = create_block(gen_label(gen, "while.cond"));
    IRBlock *body_block = create_block(gen_label(gen, "while.body"));
    IRBlock *after_block = create_block(gen_label(gen, "while.after"));
    
    ir_block_add_instr(gen->current_block, ir_create_jump(cond_block->label));
    
    /* Condition */
    ir_function_add_block(gen->current_function, cond_block);
    gen->current_block = cond_block;
    void *cond = process_expression(gen, stmt->u.loop.cond);
    IRValue *cond_val = ensure_value(gen, cond);
    ir_block_add_instr(gen->current_block, ir_create_jump_if(cond_val, body_block->label, after_block->label));
    
    /* Body */
    ir_function_add_block(gen->current_function, body_block);
    gen->current_block = body_block;
    process_statement(gen, stmt->u.loop.body);
    if (gen->current_block) {
        ir_block_add_instr(gen->current_block, ir_create_jump(cond_block->label));
    }
    
    /* After */
    ir_function_add_block(gen->current_function, after_block);
    gen->current_block = after_block;
}

static void process_for_statement(IRGenerator *gen, ASTNode *stmt) {
    if (!gen->current_function || !gen->current_block) return;
    
    /* Init */
    if (stmt->u.for_stmt.init) {
        if (stmt->u.for_stmt.init->type == NT_DECLARATION) {
            process_variable_declaration(gen, stmt->u.for_stmt.init);
        } else {
            process_expression(gen, stmt->u.for_stmt.init);
        }
    }
    
    IRBlock *cond_block = create_block(gen_label(gen, "for.cond"));
    IRBlock *body_block = create_block(gen_label(gen, "for.body"));
    IRBlock *inc_block = create_block(gen_label(gen, "for.inc"));
    IRBlock *after_block = create_block(gen_label(gen, "for.after"));
    
    ir_block_add_instr(gen->current_block, ir_create_jump(cond_block->label));
    
    /* Condition */
    ir_function_add_block(gen->current_function, cond_block);
    gen->current_block = cond_block;
    void *cond;
    if (stmt->u.for_stmt.cond) {
        cond = process_expression(gen, stmt->u.for_stmt.cond);
    } else {
        cond = ir_create_constant(1, IR_I32);
    }
    IRValue *cond_val2 = ensure_value(gen, cond);
    ir_block_add_instr(gen->current_block, ir_create_jump_if(cond_val2, body_block->label, after_block->label));
    
    /* Body */
    ir_function_add_block(gen->current_function, body_block);
    gen->current_block = body_block;
    process_statement(gen, stmt->u.for_stmt.body);
    if (gen->current_block) {
        ir_block_add_instr(gen->current_block, ir_create_jump(inc_block->label));
    }
    
    /* Increment */
    ir_function_add_block(gen->current_function, inc_block);
    gen->current_block = inc_block;
    if (stmt->u.for_stmt.incr) {
        process_expression(gen, stmt->u.for_stmt.incr);
    }
    ir_block_add_instr(gen->current_block, ir_create_jump(cond_block->label));
    
    /* After */
    ir_function_add_block(gen->current_function, after_block);
    gen->current_block = after_block;
}

static void process_do_while_statement(IRGenerator *gen, ASTNode *stmt) {
    if (!gen->current_function || !gen->current_block) return;
    
    IRBlock *body_block = create_block(gen_label(gen, "do_while.body"));
    IRBlock *cond_block = create_block(gen_label(gen, "do_while.cond"));
    IRBlock *after_block = create_block(gen_label(gen, "do_while.after"));
    
    ir_block_add_instr(gen->current_block, ir_create_jump(body_block->label));
    
    /* Body */
    ir_function_add_block(gen->current_function, body_block);
    gen->current_block = body_block;
    process_statement(gen, stmt->u.loop.body);
    if (gen->current_block) {
        ir_block_add_instr(gen->current_block, ir_create_jump(cond_block->label));
    }
    
    /* Condition */
    ir_function_add_block(gen->current_function, cond_block);
    gen->current_block = cond_block;
    void *cond = process_expression(gen, stmt->u.loop.cond);
    IRValue *cond_val3 = ensure_value(gen, cond);
    ir_block_add_instr(gen->current_block, ir_create_jump_if(cond_val3, body_block->label, after_block->label));
    
    /* After */
    ir_function_add_block(gen->current_function, after_block);
    gen->current_block = after_block;
}

static void process_return_statement(IRGenerator *gen, ASTNode *stmt) {
    if (!gen->current_block) return;
    
    IRRet *ret;
    if (stmt->u.ret.value) {
        void *val = process_expression(gen, stmt->u.ret.value);
        IRType t = IR_VOID;
        /* Try to determine type */
        if (val) {
            /* Heuristic: check if it looks like IRValue or IRConstant */
            IRValue *v = val;
            if (!v->is_constant) {
                t = v->type;
            } else {
                IRConstant *c = val;
                t = c->type;
            }
        }
        ret = ir_create_ret(t, val);
    } else {
        ret = ir_create_ret(IR_VOID, NULL);
    }
    ir_block_add_instr(gen->current_block, ret);
}

static void process_compound_statement(IRGenerator *gen, ASTNode *stmt) {
    for (int i = 0; i < stmt->u.compound.nstmts; i++) {
        if (gen->current_block) {
            process_statement(gen, stmt->u.compound.stmts[i]);
        }
    }
}

static void process_statement(IRGenerator *gen, ASTNode *stmt) {
    switch (stmt->type) {
    case NT_DECLARATION:
        process_variable_declaration(gen, stmt);
        break;
    case NT_MULTI_DECLARATION:
        for (int i = 0; i < stmt->u.multi.ndecls; i++) {
            process_variable_declaration(gen, stmt->u.multi.decls[i]);
        }
        break;
    case NT_ASSIGNMENT:
        process_assignment(gen, stmt);
        break;
    case NT_IF_STMT:
        process_if_statement(gen, stmt);
        break;
    case NT_WHILE_STMT:
        process_while_statement(gen, stmt);
        break;
    case NT_FOR_STMT:
        process_for_statement(gen, stmt);
        break;
    case NT_DO_WHILE_STMT:
        process_do_while_statement(gen, stmt);
        break;
    case NT_RETURN_STMT:
        process_return_statement(gen, stmt);
        break;
    case NT_EXPR_STMT:
        process_expression(gen, stmt->u.expr_stmt.expr);
        break;
    case NT_COMPOUND_STMT:
        process_compound_statement(gen, stmt);
        break;
    case NT_BREAK_STMT:
    case NT_CONTINUE_STMT:
    case NT_EMPTY_STMT:
        break;
    case NT_GOTO_STMT:
        if (gen->current_block) {
            ir_block_add_instr(gen->current_block, ir_create_jump(stmt->u.label.label));
        }
        break;
    case NT_LABEL_STMT:
        if (gen->current_function && gen->current_block) {
            IRBlock *label_block = create_block(stmt->u.label.label);
            ir_function_add_block(gen->current_function, label_block);
            gen->current_block = label_block;
        }
        break;
    default:
        break;
    }
}

/* ========================================================================
   Expressions
   ======================================================================== */

static IROpCode binary_op_to_ir(const char *op) {
    if (strcmp(op, "+") == 0) return IR_OP_ADD;
    if (strcmp(op, "-") == 0) return IR_OP_SUB;
    if (strcmp(op, "*") == 0) return IR_OP_MUL;
    if (strcmp(op, "/") == 0) return IR_OP_DIV;
    if (strcmp(op, "%") == 0) return IR_OP_MOD;
    if (strcmp(op, "<<") == 0) return IR_OP_SHL;
    if (strcmp(op, ">>") == 0) return IR_OP_SHR;
    if (strcmp(op, "&") == 0) return IR_OP_BAND;
    if (strcmp(op, "|") == 0) return IR_OP_BOR;
    if (strcmp(op, "^") == 0) return IR_OP_BXOR;
    if (strcmp(op, "==") == 0) return IR_OP_EQ;
    if (strcmp(op, "!=") == 0) return IR_OP_NE;
    if (strcmp(op, "<") == 0) return IR_OP_LT;
    if (strcmp(op, "<=") == 0) return IR_OP_LE;
    if (strcmp(op, ">") == 0) return IR_OP_GT;
    if (strcmp(op, ">=") == 0) return IR_OP_GE;
    if (strcmp(op, "&&") == 0) return IR_OP_AND;
    if (strcmp(op, "||") == 0) return IR_OP_OR;
    return IR_OP_ADD;
}

static void *process_binary_expression(IRGenerator *gen, ASTNode *expr) {
    if (!gen->current_block) return ir_create_constant(0, IR_I32);
    
    void *left = process_expression(gen, expr->u.binary.left);
    void *right = process_expression(gen, expr->u.binary.right);
    
    if (strcmp(expr->u.binary.op, ",") == 0) return right;
    
    IROpCode opcode = binary_op_to_ir(expr->u.binary.op);
    IRType left_type = IR_I32, right_type = IR_I32;
    
    /* Determine types */
    IRValue *lv = left;
    IRConstant *lc = left;
    if (!lv->is_constant) {
        left_type = lv->type;
    } else {
        left_type = lc->type;
    }
    
    lv = right;
    lc = right;
    if (!lv->is_constant) {
        right_type = lv->type;
    } else {
        right_type = lc->type;
    }
    
    IRType result_type = get_result_type(opcode, left_type, right_type);
    IRInstruction *instr = ir_create_instruction(gen_id(gen), opcode, result_type);
    instr->num_operands = 2;
    instr->operands = calloc(2, sizeof(void*));
    instr->operands[0] = left;
    instr->operands[1] = right;
    ir_block_add_instr(gen->current_block, instr);
    return instr;
}

static void *process_unary_expression(IRGenerator *gen, ASTNode *expr) {
    if (!gen->current_block) return ir_create_constant(0, IR_I32);
    
    const char *op = expr->u.unary.op;
    
    if (strcmp(op, "&") == 0) {
        ASTNode *operand = expr->u.unary.operand;
        if (operand->type == NT_IDENTIFIER) {
            IRValue *addr = value_map_get(gen, operand->u.ident.name);
            if (addr) return addr;
            for (int i = 0; i < gen->module->num_globals; i++) {
                if (strcmp(gen->module->globals[i]->name, operand->u.ident.name) == 0) {
                    return ir_create_value(operand->u.ident.name, IR_PTR);
                }
            }
        }
        return process_expression(gen, operand);
    }
    
    if (strcmp(op, "*") == 0) {
        void *ptr = process_expression(gen, expr->u.unary.operand);
        IRType result_type = IR_I32;
        IRValue *v = ptr;
        if (!v->is_constant) {
            result_type = v->type;
        }
        IRInstruction *load = ir_create_instruction(gen_id(gen), IR_OP_LOAD, result_type);
        load->num_operands = 1;
        load->operands = calloc(1, sizeof(void*));
        load->operands[0] = ptr;
        ir_block_add_instr(gen->current_block, load);
        return load;
    }
    
    void *operand = process_expression(gen, expr->u.unary.operand);
    
    if (strcmp(op, "++") == 0 || strcmp(op, "--") == 0 ||
        strcmp(op, "++_post") == 0 || strcmp(op, "--_post") == 0) {
        int is_post = (strcmp(op, "++_post") == 0 || strcmp(op, "--_post") == 0);
        int is_inc = (strcmp(op, "++") == 0 || strcmp(op, "++_post") == 0);
        
        ASTNode *target = expr->u.unary.operand;
        IRValue *addr = NULL;
        if (target->type == NT_IDENTIFIER) {
            addr = value_map_get(gen, target->u.ident.name);
            if (!addr) {
                for (int i = 0; i < gen->module->num_globals; i++) {
                    if (strcmp(gen->module->globals[i]->name, target->u.ident.name) == 0) {
                        addr = ir_create_value(target->u.ident.name, IR_PTR);
                        break;
                    }
                }
            }
        }
        
        if (addr) {
            IRType val_type = IR_I32;
            IRValue *vv = addr;
            if (!vv->is_constant) {
                val_type = vv->type;
            }
            
            IRInstruction *load = ir_create_instruction(gen_id(gen), IR_OP_LOAD, val_type);
            load->num_operands = 1;
            load->operands = calloc(1, sizeof(void*));
            load->operands[0] = addr;
            ir_block_add_instr(gen->current_block, load);
            
            IRInstruction *add = ir_create_instruction(gen_id(gen), IR_OP_ADD, val_type);
            add->num_operands = 2;
            add->operands = calloc(2, sizeof(void*));
            add->operands[0] = load;
            add->operands[1] = ir_create_constant(is_inc ? 1 : -1, val_type);
            ir_block_add_instr(gen->current_block, add);
            
            IRInstruction *store = ir_create_instruction(gen_id(gen), IR_OP_STORE, IR_VOID);
            store->num_operands = 2;
            store->operands = calloc(2, sizeof(void*));
            store->operands[0] = add;
            store->operands[1] = addr;
            ir_block_add_instr(gen->current_block, store);
            
            return is_post ? load : add;
        }
    }
    
    if (strcmp(op, "-") == 0) {
        IRType operand_type = IR_I32;
        IRValue *v = operand;
        if (!v->is_constant) {
            operand_type = v->type;
        } else {
            IRConstant *c = operand;
            operand_type = c->type;
        }
        IRInstruction *instr = ir_create_instruction(gen_id(gen), IR_OP_SUB, operand_type);
        instr->num_operands = 2;
        instr->operands = calloc(2, sizeof(void*));
        instr->operands[0] = ir_create_constant(0, operand_type);
        instr->operands[1] = operand;
        ir_block_add_instr(gen->current_block, instr);
        return instr;
    }
    
    if (strcmp(op, "!") == 0 || strcmp(op, "~") == 0) {
        IROpCode opcode = (strcmp(op, "!") == 0) ? IR_OP_NOT : IR_OP_BNOT;
        IRInstruction *instr = ir_create_instruction(gen_id(gen), opcode, IR_I32);
        instr->num_operands = 1;
        instr->operands = calloc(1, sizeof(void*));
        instr->operands[0] = operand;
        ir_block_add_instr(gen->current_block, instr);
        return instr;
    }
    
    return operand;
}

static void *process_function_call(IRGenerator *gen, ASTNode *call) {
    if (!gen->current_block) return ir_create_constant(0, IR_I32);
    
    char *callee_name = NULL;
    if (call->u.call.callee->type == NT_IDENTIFIER) {
        callee_name = call->u.call.callee->u.ident.name;
    } else {
        callee_name = "unknown_function";
    }
    
    IRCall *call_instr = ir_create_call(callee_name, IR_I32);
    call_instr->num_args = call->u.call.nargs;
    if (call_instr->num_args > 0) {
        call_instr->args = calloc(call_instr->num_args, sizeof(void*));
        for (int i = 0; i < call_instr->num_args; i++) {
            call_instr->args[i] = process_expression(gen, call->u.call.args[i]);
        }
    }
    ir_block_add_instr(gen->current_block, call_instr);
    
    return ir_create_value(gen_id(gen), IR_I32);
}

static void *process_identifier(IRGenerator *gen, ASTNode *expr) {
    const char *name = expr->u.ident.name;
    
    /* Check if it's a function */
    for (int i = 0; i < gen->module->num_functions; i++) {
        if (strcmp(gen->module->functions[i]->name, name) == 0) {
            return ir_create_value(name, IR_I32);
        }
    }
    
    /* Check global */
    for (int i = 0; i < gen->module->num_globals; i++) {
        if (strcmp(gen->module->globals[i]->name, name) == 0) {
            IRGlobal *g = gen->module->globals[i];
            IRValue *global_val = ir_create_value(name, g->type);
            if (!gen->current_block) return global_val;
            IRInstruction *load = ir_create_instruction(gen_id(gen), IR_OP_LOAD, g->type);
            load->num_operands = 1;
            load->operands = calloc(1, sizeof(void*));
            load->operands[0] = global_val;
            ir_block_add_instr(gen->current_block, load);
            return load;
        }
    }
    
    /* Check local */
    IRValue *addr = value_map_get(gen, name);
    if (!addr) {
        /* Could be an enum constant - return 0 for now */
        return ir_create_constant(0, IR_I32);
    }
    
    if (!gen->current_block) return addr;
    
    IRType val_type = IR_I32;
    IRValue *vv = addr;
    if (!vv->is_constant) {
        val_type = vv->type;
    }
    
    IRInstruction *load = ir_create_instruction(gen_id(gen), IR_OP_LOAD, val_type);
    load->num_operands = 1;
    load->operands = calloc(1, sizeof(void*));
    load->operands[0] = addr;
    ir_block_add_instr(gen->current_block, load);
    return load;
}

static void *process_ternary_expression(IRGenerator *gen, ASTNode *expr) {
    if (!gen->current_function || !gen->current_block) return ir_create_constant(0, IR_I32);
    
    void *cond = process_expression(gen, expr->u.ternary.cond);
    IRValue *cond_val = ensure_value(gen, cond);
    
    IRBlock *true_block = create_block(gen_label(gen, "ternary_true"));
    IRBlock *false_block = create_block(gen_label(gen, "ternary_false"));
    IRBlock *end_block = create_block(gen_label(gen, "ternary_end"));
    
    ir_block_add_instr(gen->current_block, ir_create_jump_if(cond_val, true_block->label, false_block->label));
    
    ir_function_add_block(gen->current_function, true_block);
    gen->current_block = true_block;
    void *true_val = process_expression(gen, expr->u.ternary.then_expr);
    ir_block_add_instr(gen->current_block, ir_create_jump(end_block->label));
    
    ir_function_add_block(gen->current_function, false_block);
    gen->current_block = false_block;
    (void)process_expression(gen, expr->u.ternary.else_expr);
    ir_block_add_instr(gen->current_block, ir_create_jump(end_block->label));
    
    ir_function_add_block(gen->current_function, end_block);
    gen->current_block = end_block;
    
    IRType result_type = IR_I32;
    IRValue *v = true_val;
    if (!v->is_constant) {
        result_type = v->type;
    } else {
        IRConstant *c = true_val;
        result_type = c->type;
    }
    
    return ir_create_value(gen_id(gen), result_type);
}

static void *process_expression(IRGenerator *gen, ASTNode *expr) {
    switch (expr->type) {
    case NT_ASSIGNMENT:
        process_assignment(gen, expr);
        return process_expression(gen, expr->u.assign.value);
    case NT_BINARY_EXPR:
        return process_binary_expression(gen, expr);
    case NT_UNARY_EXPR:
        return process_unary_expression(gen, expr);
    case NT_POSTFIX_EXPR:
        return process_unary_expression(gen, expr);
    case NT_TERNARY_EXPR:
        return process_ternary_expression(gen, expr);
    case NT_FUNCTION_CALL:
        return process_function_call(gen, expr);
    case NT_IDENTIFIER:
        return process_identifier(gen, expr);
    case NT_NUMBER_LIT: {
        const char *val = expr->u.number.value;
        if (strchr(val, '.') || strchr(val, 'e') || strchr(val, 'E'))
            return ir_create_constant(atof(val), IR_F64);
        if (val[strlen(val)-1] == 'f' || val[strlen(val)-1] == 'F')
            return ir_create_constant(atof(val), IR_F32);
        if (val[strlen(val)-1] == 'l' || val[strlen(val)-1] == 'L')
            return ir_create_constant(atol(val), IR_I64);
        return ir_create_constant(atoi(val), IR_I32);
    }
    case NT_CHAR_LIT:
        return ir_create_constant(expr->u.str_lit.value[0], IR_I8);
    case NT_STRING_LIT: {
        /* Create a global string */
        char *str_name = gen_id(gen);
        IRGlobal *g = calloc(1, sizeof(IRGlobal));
        g->name = strdup(str_name);
        g->type = IR_PTR;
        ir_module_add_global(gen->module, g);
        return ir_create_value(str_name, IR_PTR);
    }
    case NT_SIZEOF_EXPR:
        return ir_create_constant(4, IR_I32);
    case NT_CAST_EXPR:
        return process_expression(gen, expr->u.cast.operand);
    case NT_MEMBER_ACCESS:
        return ir_create_constant(0, IR_I32);
    case NT_ARRAY_ACCESS: {
        void *arr = process_expression(gen, expr->u.arr.array);
        (void)process_expression(gen, expr->u.arr.index);
        IRType result_type = IR_I32;
        IRValue *v = arr;
        if (!v->is_constant) {
            result_type = v->type;
        }
        IRInstruction *load = ir_create_instruction(gen_id(gen), IR_OP_LOAD, result_type);
        load->num_operands = 1;
        load->operands = calloc(1, sizeof(void*));
        load->operands[0] = arr;
        ir_block_add_instr(gen->current_block, load);
        return load;
    }
    default:
        return ir_create_constant(0, IR_I32);
    }
}

/* ========================================================================
   Public API
   ======================================================================== */

IRGenerator *irgen_create(void) {
    IRGenerator *gen = calloc(1, sizeof(IRGenerator));
    gen->module = ir_module_create();
    return gen;
}

void irgen_free(IRGenerator *gen) {
    if (!gen) return;
    value_map_clear(gen);
    ir_module_free(gen->module);
    free(gen);
}

IRModule *irgen_generate(IRGenerator *gen, ASTNode *program) {
    if (!gen || !program || program->type != NT_PROGRAM) return gen->module;
    
    /* First pass: globals */
    for (int i = 0; i < program->u.program.ndecls; i++) {
        ASTNode *decl = program->u.program.decls[i];
        if (decl->type == NT_DECLARATION) {
            process_global_declaration(gen, decl);
        }
    }
    
    /* Second pass: functions */
    for (int i = 0; i < program->u.program.ndecls; i++) {
        ASTNode *decl = program->u.program.decls[i];
        if (decl->type == NT_FUNCTION_DECL) {
            process_function_declaration(gen, decl);
        }
    }
    
    return gen->module;
}

char *irgen_pretty_print(IRModule *mod) {
    return ir_pretty_print(mod);
}
