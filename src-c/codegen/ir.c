#define _POSIX_C_SOURCE 200809L
#include "ir.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const char *ir_opcode_name(IROpCode op) {
    switch (op) {
    case IR_OP_ADD: return "add";
    case IR_OP_SUB: return "sub";
    case IR_OP_MUL: return "mul";
    case IR_OP_DIV: return "div";
    case IR_OP_MOD: return "mod";
    case IR_OP_SHL: return "shl";
    case IR_OP_SHR: return "shr";
    case IR_OP_BAND: return "band";
    case IR_OP_BOR: return "bor";
    case IR_OP_BXOR: return "bxor";
    case IR_OP_BNOT: return "bnot";
    case IR_OP_EQ: return "eq";
    case IR_OP_NE: return "ne";
    case IR_OP_LT: return "lt";
    case IR_OP_LE: return "le";
    case IR_OP_GT: return "gt";
    case IR_OP_GE: return "ge";
    case IR_OP_AND: return "and";
    case IR_OP_OR: return "or";
    case IR_OP_NOT: return "not";
    case IR_OP_LOAD: return "load";
    case IR_OP_STORE: return "store";
    case IR_OP_ALLOCA: return "alloca";
    case IR_OP_JUMP: return "jump";
    case IR_OP_JUMP_IF: return "jump_if";
    case IR_OP_CALL: return "call";
    case IR_OP_RET: return "ret";
    case IR_OP_PHI: return "phi";
    case IR_OP_ASM: return "asm";
    case IR_OP_TRUNC: return "trunc";
    case IR_OP_ZEXT: return "zext";
    case IR_OP_SEXT: return "sext";
    case IR_OP_NEG: return "neg";
    case IR_OP_MOV: return "mov";
    }
    return "unknown";
}

const char *ir_type_name(IRType type) {
    switch (type) {
    case IR_I8: return "i8";
    case IR_I16: return "i16";
    case IR_I32: return "i32";
    case IR_I64: return "i64";
    case IR_F32: return "f32";
    case IR_F64: return "f64";
    case IR_VOID: return "void";
    case IR_PTR: return "ptr";
    }
    return "unknown";
}

int ir_type_size(IRType type) {
    switch (type) {
    case IR_I8: return 1;
    case IR_I16: return 2;
    case IR_I32: return 4;
    case IR_I64: return 8;
    case IR_F32: return 4;
    case IR_F64: return 8;
    case IR_PTR: return 8;
    case IR_VOID: return 0;
    }
    return 4;
}

int ir_is_pointer_type(IRType type) { return type == IR_PTR; }
int ir_is_integer_type(IRType type) { return type == IR_I8 || type == IR_I16 || type == IR_I32 || type == IR_I64; }

IRValue *ir_create_value(const char *id, IRType type) {
    IRValue *v = calloc(1, sizeof(IRValue));
    v->is_constant = 0;
    v->id = strdup(id);
    v->type = type;
    return v;
}

IRConstant *ir_create_constant(double value, IRType type) {
    IRConstant *c = calloc(1, sizeof(IRConstant));
    c->is_constant = 1;
    c->value = value;
    c->type = type;
    return c;
}

IRInstruction *ir_create_instruction(const char *id, IROpCode opcode, IRType type) {
    IRInstruction *instr = calloc(1, sizeof(IRInstruction));
    instr->tag = IR_INSTR;
    instr->id = strdup(id);
    instr->opcode = opcode;
    instr->type = type;
    instr->num_operands = 0;
    instr->operands = NULL;
    return instr;
}

IRJump *ir_create_jump(const char *target) {
    IRJump *j = calloc(1, sizeof(IRJump));
    j->tag = IR_INSTR_JUMP;
    j->target = strdup(target);
    return j;
}

IRJumpIf *ir_create_jump_if(IRValue *condition, const char *true_target, const char *false_target) {
    IRJumpIf *j = calloc(1, sizeof(IRJumpIf));
    j->tag = IR_INSTR_JUMP_IF;
    j->condition = condition;
    j->true_target = strdup(true_target);
    j->false_target = strdup(false_target);
    return j;
}

IRCall *ir_create_call(const char *callee, IRType type) {
    IRCall *c = calloc(1, sizeof(IRCall));
    c->tag = IR_INSTR_CALL;
    c->callee = strdup(callee);
    c->type = type;
    c->num_args = 0;
    c->args = NULL;
    return c;
}

IRRet *ir_create_ret(IRType type, void *value) {
    IRRet *r = calloc(1, sizeof(IRRet));
    r->tag = IR_INSTR_RET;
    r->type = type;
    r->value = value;
    return r;
}

void ir_block_add_instr(IRBlock *block, void *instr) {
    if (block->num_instrs >= block->cap_instrs) {
        block->cap_instrs = block->cap_instrs ? block->cap_instrs * 2 : 8;
        block->instrs = realloc(block->instrs, sizeof(void*) * block->cap_instrs);
    }
    block->instrs[block->num_instrs++] = instr;
}

void ir_function_add_block(IRFunction *func, IRBlock *block) {
    if (func->num_blocks >= func->cap_blocks) {
        func->cap_blocks = func->cap_blocks ? func->cap_blocks * 2 : 8;
        func->body = realloc(func->body, sizeof(IRBlock*) * func->cap_blocks);
    }
    func->body[func->num_blocks++] = block;
}

void ir_function_add_local(IRFunction *func, const char *name, IRType type) {
    func->locals = realloc(func->locals, sizeof(IRLocal) * (func->num_locals + 1));
    func->locals[func->num_locals].name = strdup(name);
    func->locals[func->num_locals].type = type;
    func->num_locals++;
}

void ir_module_add_function(IRModule *mod, IRFunction *func) {
    if (mod->num_functions >= mod->cap_functions) {
        mod->cap_functions = mod->cap_functions ? mod->cap_functions * 2 : 8;
        mod->functions = realloc(mod->functions, sizeof(IRFunction*) * mod->cap_functions);
    }
    mod->functions[mod->num_functions++] = func;
}

void ir_module_add_global(IRModule *mod, IRGlobal *global) {
    if (mod->num_globals >= mod->cap_globals) {
        mod->cap_globals = mod->cap_globals ? mod->cap_globals * 2 : 8;
        mod->globals = realloc(mod->globals, sizeof(IRGlobal*) * mod->cap_globals);
    }
    mod->globals[mod->num_globals++] = global;
}

IRModule *ir_module_create(void) {
    IRModule *mod = calloc(1, sizeof(IRModule));
    return mod;
}

void ir_module_free(IRModule *mod) {
    if (!mod) return;
    for (int i = 0; i < mod->num_functions; i++) {
        IRFunction *f = mod->functions[i];
        for (int j = 0; j < f->num_blocks; j++) {
            IRBlock *b = f->body[j];
            for (int k = 0; k < b->num_instrs; k++) {
                void *instr = b->instrs[k];
                IRInstrType tag = *(IRInstrType*)instr;
                if (tag == IR_INSTR) {
                    IRInstruction *ii = instr;
                    free(ii->id); free(ii->operands); free(ii);
                } else if (tag == IR_INSTR_JUMP) {
                    IRJump *jj = instr; free(jj->target); free(jj);
                } else if (tag == IR_INSTR_JUMP_IF) {
                    IRJumpIf *ji = instr;
                    free(ji->true_target); free(ji->false_target); free(ji);
                } else if (tag == IR_INSTR_CALL) {
                    IRCall *cc = instr;
                    free(cc->callee); free(cc->args); free(cc);
                } else if (tag == IR_INSTR_RET) {
                    free(instr);
                }
            }
            free(b->instrs); free(b->label); free(b);
        }
        free(f->body);
        for (int j = 0; j < f->num_params; j++) free(f->params[j].name);
        free(f->params);
        for (int j = 0; j < f->num_locals; j++) free(f->locals[j].name);
        free(f->locals);
        free(f->name); free(f);
    }
    free(mod->functions);
    for (int i = 0; i < mod->num_globals; i++) {
        IRGlobal *g = mod->globals[i];
        free(g->name);
        if (g->initializer) free(g->initializer);
        if (g->array_init) {
            for (int j = 0; j < g->array_size; j++) free(g->array_init[j]);
            free(g->array_init);
        }
        free(g);
    }
    free(mod->globals);
    free(mod);
}

/* ========================================================================
   Pretty print
   ======================================================================== */

static int is_value(void *operand) {
    IRValue *v = operand;
    return v->is_constant == 0;
}

char *ir_pretty_print(IRModule *mod) {
    static char buf[65536];
    size_t off = 0;
    
    for (int i = 0; i < mod->num_globals; i++) {
        IRGlobal *g = mod->globals[i];
        off += snprintf(buf + off, sizeof(buf) - off, "@%s = global %s", g->name, ir_type_name(g->type));
        if (g->is_array) {
            off += snprintf(buf + off, sizeof(buf) - off, "[%d]", g->array_size);
        }
        if (g->initializer) {
            off += snprintf(buf + off, sizeof(buf) - off, " %d", (int)g->initializer->value);
        }
        off += snprintf(buf + off, sizeof(buf) - off, "\n");
    }
    if (mod->num_globals > 0) off += snprintf(buf + off, sizeof(buf) - off, "\n");
    
    for (int i = 0; i < mod->num_functions; i++) {
        IRFunction *f = mod->functions[i];
        off += snprintf(buf + off, sizeof(buf) - off, "define %s @%s(", ir_type_name(f->return_type), f->name);
        for (int j = 0; j < f->num_params; j++) {
            if (j > 0) off += snprintf(buf + off, sizeof(buf) - off, ", ");
            off += snprintf(buf + off, sizeof(buf) - off, "%s %s", ir_type_name(f->params[j].type), f->params[j].name);
        }
        off += snprintf(buf + off, sizeof(buf) - off, ") {\n");
        
        for (int j = 0; j < f->num_locals; j++) {
            off += snprintf(buf + off, sizeof(buf) - off, "  %%%s = alloca %s\n", f->locals[j].name, ir_type_name(f->locals[j].type));
        }
        
        for (int j = 0; j < f->num_blocks; j++) {
            IRBlock *b = f->body[j];
            off += snprintf(buf + off, sizeof(buf) - off, "\n%s:\n", b->label);
            for (int k = 0; k < b->num_instrs; k++) {
                void *instr = b->instrs[k];
                IRInstrType tag = *(IRInstrType*)instr;
                if (tag == IR_INSTR) {
                    IRInstruction *ii = instr;
                    if (ii->opcode == IR_OP_ASM) {
                        off += snprintf(buf + off, sizeof(buf) - off, "  asm\n");
                    } else {
                        off += snprintf(buf + off, sizeof(buf) - off, "  %%%s = %s %s", ii->id, ir_opcode_name(ii->opcode), ir_type_name(ii->type));
                        for (int o = 0; o < ii->num_operands; o++) {
                            void *op = ii->operands[o];
                            if (is_value(op)) {
                                IRValue *v = op;
                                off += snprintf(buf + off, sizeof(buf) - off, " %%%s", v->id);
                            } else {
                                IRConstant *c = op;
                                off += snprintf(buf + off, sizeof(buf) - off, " %d", (int)c->value);
                            }
                        }
                        off += snprintf(buf + off, sizeof(buf) - off, "\n");
                    }
                } else if (tag == IR_INSTR_JUMP) {
                    IRJump *jj = instr;
                    off += snprintf(buf + off, sizeof(buf) - off, "  jump %s\n", jj->target);
                } else if (tag == IR_INSTR_JUMP_IF) {
                    IRJumpIf *ji = instr;
                    off += snprintf(buf + off, sizeof(buf) - off, "  jump_if %%%s, %s, %s\n", ji->condition->id, ji->true_target, ji->false_target);
                } else if (tag == IR_INSTR_CALL) {
                    IRCall *cc = instr;
                    off += snprintf(buf + off, sizeof(buf) - off, "  call %s(", cc->callee);
                    for (int a = 0; a < cc->num_args; a++) {
                        if (a > 0) off += snprintf(buf + off, sizeof(buf) - off, ", ");
                        void *arg = cc->args[a];
                        if (is_value(arg)) {
                            IRValue *v = arg;
                            off += snprintf(buf + off, sizeof(buf) - off, "%%%s", v->id);
                        } else {
                            IRConstant *c = arg;
                            off += snprintf(buf + off, sizeof(buf) - off, "%d", (int)c->value);
                        }
                    }
                    off += snprintf(buf + off, sizeof(buf) - off, ")\n");
                } else if (tag == IR_INSTR_RET) {
                    IRRet *rr = instr;
                    if (rr->value) {
                        void *val = rr->value;
                        if (is_value(val)) {
                            IRValue *v = val;
                            off += snprintf(buf + off, sizeof(buf) - off, "  ret %%%s\n", v->id);
                        } else {
                            IRConstant *c = val;
                            off += snprintf(buf + off, sizeof(buf) - off, "  ret %d\n", (int)c->value);
                        }
                    } else {
                        off += snprintf(buf + off, sizeof(buf) - off, "  ret void\n");
                    }
                }
            }
        }
        off += snprintf(buf + off, sizeof(buf) - off, "}\n\n");
    }
    
    return buf;
}
