#define _POSIX_C_SOURCE 200809L
#include "asmgen.h"
#include "target.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

typedef struct {
    char   *data;
    size_t  len;
    size_t  cap;
} SB;

static void sb_init(SB *sb) { memset(sb, 0, sizeof(*sb)); }
static void sb_free(SB *sb) { free(sb->data); sb->data = NULL; sb->len = sb->cap = 0; }

static void sb_append(SB *sb, const char *s) {
    size_t sl = strlen(s);
    if (sb->len + sl + 1 > sb->cap) {
        size_t nc = sb->cap ? sb->cap * 2 : 4096;
        while (sb->len + sl + 1 > nc) nc *= 2;
        char *p = realloc(sb->data, nc);
        if (!p) { fprintf(stderr, "OOM\n"); exit(1); }
        sb->data = p; sb->cap = nc;
    }
    memcpy(sb->data + sb->len, s, sl);
    sb->len += sl;
    sb->data[sb->len] = '\0';
}

static void sb_printf(SB *sb, const char *fmt, ...) {
    va_list ap, ap2;
    va_start(ap, fmt);
    va_copy(ap2, ap);
    int len = vsnprintf(NULL, 0, fmt, ap2);
    va_end(ap2);
    char *buf = malloc((size_t)len + 1);
    if (!buf) { fprintf(stderr, "OOM\n"); exit(1); }
    vsnprintf(buf, (size_t)len + 1, fmt, ap);
    va_end(ap);
    sb_append(sb, buf);
    free(buf);
}

static char *sb_detach(SB *sb) {
    char *r = sb->data ? sb->data : strdup("");
    sb->data = NULL; sb->len = sb->cap = 0;
    return r;
}

typedef struct {
    char     *value_id;
    Register  reg;
    int       used;
} RegEntry;

typedef struct {
    RegEntry         entries[64];
    int              num;
    CallingConvention cc;
} RegAlloc;

static void ra_init(RegAlloc *ra, CallingConvention cc) {
    memset(ra, 0, sizeof(*ra)); ra->cc = cc;
}

static Register *ra_alloc(RegAlloc *ra, const char *id, IRType type) {
    if (ra->num >= 64) return NULL;
    int isf = ir_is_floating_point_type(type);
    int n = isf ? ra->cc.num_float_caller_save_regs : ra->cc.num_caller_save_regs;
    const Register *rs = isf ? ra->cc.float_caller_save_regs : ra->cc.caller_save_regs;
    for (int i = 0; i < n; i++) {
        int taken = 0;
        for (int j = 0; j < ra->num; j++)
            if (ra->entries[j].used && strcmp(ra->entries[j].reg.name, rs[i].name) == 0)
                { taken = 1; break; }
        if (!taken) {
            RegEntry *e = &ra->entries[ra->num++];
            e->value_id = strdup(id); e->reg = rs[i]; e->used = 1;
            return &e->reg;
        }
    }
    return NULL;
}

static Register *ra_get(RegAlloc *ra, const char *id) {
    for (int i = 0; i < ra->num; i++)
        if (ra->entries[i].used && strcmp(ra->entries[i].value_id, id) == 0)
            return &ra->entries[i].reg;
    return NULL;
}

static void ra_free(RegAlloc *ra, const char *id) {
    for (int i = 0; i < ra->num; i++)
        if (ra->entries[i].used && strcmp(ra->entries[i].value_id, id) == 0)
            { free(ra->entries[i].value_id); ra->entries[i].used = 0; break; }
}

static void ra_free_all(RegAlloc *ra) {
    for (int i = 0; i < ra->num; i++) if (ra->entries[i].used) free(ra->entries[i].value_id);
    ra->num = 0;
}

typedef struct {
    char name[128]; int offset; int size;
} Slot;
typedef struct {
    Slot slots[256]; int num; int total; int align;
} StackFrame;

static void sf_init(StackFrame *sf, int al) { memset(sf, 0, sizeof(*sf)); sf->align = al; }

static int sf_alloc(StackFrame *sf, const char *name, int sz) {
    if (sf->num >= 256) return -1;
    Slot *s = &sf->slots[sf->num++];
    snprintf(s->name, sizeof(s->name), "%s", name);
    s->offset = sf->total; s->size = sz;
    sf->total += sz;
    if (sf->total % sf->align) sf->total += sf->align - (sf->total % sf->align);
    return s->offset;
}

static Slot *sf_get(StackFrame *sf, const char *name) {
    for (int i = 0; i < sf->num; i++)
        if (strcmp(sf->slots[i].name, name) == 0) return &sf->slots[i];
    return NULL;
}

static const char *val_loc(RegAlloc *ra, StackFrame *sf, IRFunction *fn, const char *id) {
    Register *r = ra_get(ra, id);
    if (r) return r->name;
    Slot *s = sf_get(sf, id);
    if (s) {
        static char buf[2][64]; static int p = 0; p = (p+1)%2;
        snprintf(buf[p], sizeof(buf[p]), "[rbp - %d]", s->offset + 8);
        return buf[p];
    }
    for (int i = 0; i < fn->num_params; i++) {
        if (strcmp(fn->params[i].name, id) == 0) {
            if (ir_is_floating_point_type(fn->params[i].type)) {
                if (i < ra->cc.num_float_arg_regs) return ra->cc.float_arg_regs[i].name;
            } else {
                if (i < ra->cc.num_arg_regs) return ra->cc.arg_regs[i].name;
            }
        }
    }
    return id;
}

static const char *op_str(void *op, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    IRValue *v = op;
    if (v->is_constant) {
        IRConstant *c = op;
        static char buf[2][32]; static int p = 0; p = (p+1)%2;
        snprintf(buf[p], sizeof(buf[p]), "$%d", (int)c->value);
        return buf[p];
    }
    return val_loc(ra, sf, fn, v->id);
}

static void emit_bin(SB *sb, const char *mnem, IRInstruction *ii,
                      RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 2) return;
    const char *l = op_str(ii->operands[0], ra, sf, fn);
    const char *r = op_str(ii->operands[1], ra, sf, fn);
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (!res) return;
    int isf = ir_is_floating_point_type(ii->type);
    if (isf) {
        const char *mov = ii->type == IR_F32 ? "movss" : "movsd";
        const char *op = mnem;
        if (strcmp(mnem, "add")==0) op = ii->type==IR_F32?"addss":"addsd";
        else if (strcmp(mnem, "sub")==0) op = ii->type==IR_F32?"subss":"subsd";
        else if (strcmp(mnem,"imul")==0||strcmp(mnem,"mul")==0) op=ii->type==IR_F32?"mulss":"mulsd";
        sb_printf(sb, "  %s %s, %s\n", mov, l, res->name);
        sb_printf(sb, "  %s %s, %s\n", op, r, res->name);
    } else {
        sb_printf(sb, "  mov %s, %s\n", l, res->name);
        if ((strcmp(mnem, "shl")==0||strcmp(mnem, "shr")==0)&&!((IRValue*)ii->operands[1])->is_constant) {
            sb_printf(sb, "  mov %s, cl\n", r);
            sb_printf(sb, "  %s cl, %s\n", mnem, res->name);
        } else {
            sb_printf(sb, "  %s %s, %s\n", mnem, r, res->name);
        }
    }
}

static void emit_cmp(SB *sb, const char *setcc, IRInstruction *ii,
                      RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 2) return;
    const char *l = op_str(ii->operands[0], ra, sf, fn);
    const char *r = op_str(ii->operands[1], ra, sf, fn);
    int isf = ir_is_floating_point_type(((IRValue*)ii->operands[0])->type);
    (void)l;
    if (isf) {
        const char *cmp = ((IRValue*)ii->operands[0])->type==IR_F32?"ucomiss":"ucomisd";
        sb_printf(sb, "  %s %s, %s\n", cmp, r, l);
        Register *res = ra_alloc(ra, ii->id, ii->type);
        if (!res) return;
        sb_printf(sb, "  xor %s, %s\n", res->name, res->name);
        if (strcmp(setcc,"setl")==0) setcc="setb";
        else if (strcmp(setcc,"setle")==0) setcc="setbe";
        else if (strcmp(setcc,"setg")==0) setcc="seta";
        else if (strcmp(setcc,"setge")==0) setcc="setae";
        sb_printf(sb, "  %s %s\n", setcc, res->name);
    } else {
        sb_printf(sb, "  cmp %s, %s\n", r, l);
        Register *res = ra_alloc(ra, ii->id, ii->type);
        if (!res) return;
        sb_printf(sb, "  xor %s, %s\n", res->name, res->name);
        sb_printf(sb, "  %s %s\n", setcc, res->name);
    }
}

static void emit_un(SB *sb, const char *mnem, IRInstruction *ii,
                     RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 1) return;
    const char *op = op_str(ii->operands[0], ra, sf, fn);
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (!res) return;
    sb_printf(sb, "  mov %s, %s\n", op, res->name);
    sb_printf(sb, "  %s %s\n", mnem, res->name);
}

static void emit_not(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 1) return;
    const char *op = op_str(ii->operands[0], ra, sf, fn);
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (!res) return;
    sb_printf(sb, "  mov %s, %s\n", op, res->name);
    sb_printf(sb,  "  cmp $0, %s\n", res->name);
    sb_printf(sb,  "  sete %s\n", res->name);
}

static void emit_mov(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 1) return;
    const char *op = op_str(ii->operands[0], ra, sf, fn);
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (!res) return;
    sb_printf(sb, "  mov %s, %s\n", op, res->name);
}

static void emit_load(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 1) return;
    const char *addr = op_str(ii->operands[0], ra, sf, fn);
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (!res) return;
    int isf = ir_is_floating_point_type(ii->type);
    const char *mov = isf ? (ii->type==IR_F32?"movss":"movsd") : "mov";
    if ((addr[0]=='r'&&addr[1]!='e')||addr[0]=='x'||addr[0]=='e')
        sb_printf(sb, "  %s (%s), %s\n", mov, addr, res->name);
    else
        sb_printf(sb, "  %s %s, %s\n", mov, addr, res->name);
}

static void emit_st(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 2) return;
    const char *val = op_str(ii->operands[0], ra, sf, fn);
    const char *addr = op_str(ii->operands[1], ra, sf, fn);
    int isf = ir_is_floating_point_type(((IRValue*)ii->operands[0])->type);
    const char *mov = isf ? (((IRValue*)ii->operands[0])->type==IR_F32?"movss":"movsd") : "mov";
    if ((addr[0]=='r'&&addr[1]!='e')||addr[0]=='x'||addr[0]=='e')
        sb_printf(sb, "  %s %s, (%s)\n", mov, val, addr);
    else
        sb_printf(sb, "  %s %s, %s\n", mov, val, addr);
}

static void emit_div(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 2) return;
    if (ir_is_floating_point_type(ii->type)) { emit_bin(sb, "div", ii, ra, sf, fn); return; }
    const char *l = op_str(ii->operands[0], ra, sf, fn);
    const char *r = op_str(ii->operands[1], ra, sf, fn);
    sb_printf(sb, "  push rax\n  push rdx\n  push r10\n");
    sb_printf(sb, "  mov %s, rax\n  cqo\n  idiv %s\n", l, r);
    sb_printf(sb, "  mov rax, r10\n");
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (res) sb_printf(sb, "  mov r10, %s\n", res->name);
    sb_printf(sb, "  pop r10\n  pop rdx\n  pop rax\n");
}

static void emit_mod(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    if (ii->num_operands < 2) return;
    const char *l = op_str(ii->operands[0], ra, sf, fn);
    const char *r = op_str(ii->operands[1], ra, sf, fn);
    sb_printf(sb, "  push rax\n  push rdx\n  push r10\n");
    sb_printf(sb, "  mov %s, rax\n  cqo\n  idiv %s\n", l, r);
    sb_printf(sb, "  mov rdx, r10\n");
    Register *res = ra_alloc(ra, ii->id, ii->type);
    if (res) sb_printf(sb, "  mov r10, %s\n", res->name);
    sb_printf(sb, "  pop r10\n  pop rdx\n  pop rax\n");
}

static void sel_instr(SB *sb, IRInstruction *ii, RegAlloc *ra, StackFrame *sf, IRFunction *fn) {
    switch (ii->opcode) {
    case IR_OP_ADD:   emit_bin(sb, "add", ii,ra,sf,fn); break;
    case IR_OP_SUB:   emit_bin(sb, "sub", ii,ra,sf,fn); break;
    case IR_OP_MUL:   emit_bin(sb, "imul", ii,ra,sf,fn); break;
    case IR_OP_DIV:   emit_div(sb, ii,ra,sf,fn); break;
    case IR_OP_MOD:   emit_mod(sb, ii,ra,sf,fn); break;
    case IR_OP_SHL:   emit_bin(sb, "shl", ii,ra,sf,fn); break;
    case IR_OP_SHR:   emit_bin(sb, "shr", ii,ra,sf,fn); break;
    case IR_OP_BAND:  emit_bin(sb, "and", ii,ra,sf,fn); break;
    case IR_OP_BOR:   emit_bin(sb, "or", ii,ra,sf,fn); break;
    case IR_OP_BXOR:  emit_bin(sb, "xor", ii,ra,sf,fn); break;
    case IR_OP_BNOT:  emit_un(sb, "not", ii,ra,sf,fn); break;
    case IR_OP_EQ:    emit_cmp(sb, "sete", ii,ra,sf,fn); break;
    case IR_OP_NE:    emit_cmp(sb, "setne", ii,ra,sf,fn); break;
    case IR_OP_LT:    emit_cmp(sb, "setl", ii,ra,sf,fn); break;
    case IR_OP_LE:    emit_cmp(sb, "setle", ii,ra,sf,fn); break;
    case IR_OP_GT:    emit_cmp(sb, "setg", ii,ra,sf,fn); break;
    case IR_OP_GE:    emit_cmp(sb, "setge", ii,ra,sf,fn); break;
    case IR_OP_AND:   emit_bin(sb, "and", ii,ra,sf,fn); break;
    case IR_OP_OR:    emit_bin(sb, "or", ii,ra,sf,fn); break;
    case IR_OP_NOT:   emit_not(sb, ii,ra,sf,fn); break;
    case IR_OP_NEG:   emit_un(sb, "neg", ii,ra,sf,fn); break;
    case IR_OP_MOV:   emit_mov(sb, ii,ra,sf,fn); break;
    case IR_OP_LOAD:  emit_load(sb, ii,ra,sf,fn); break;
    case IR_OP_STORE: emit_st(sb, ii,ra,sf,fn); break;
    case IR_OP_ALLOCA: break;
    default: break;
    }
}

static void gen_data(SB *sb, IRModule *mod) {
    if (mod->num_globals == 0) return;
    sb_printf(sb, ".data\n");
    for (int i = 0; i < mod->num_globals; i++) {
        IRGlobal *g = mod->globals[i];
        sb_printf(sb, "  .globl %s\n", g->name);
        sb_printf(sb, "  .align 16\n  %s:\n", g->name);
        if (g->initializer) {
            if (g->type==IR_I32||g->type==IR_F32) sb_printf(sb,"  .long %d\n",(int)g->initializer->value);
            else if (g->type==IR_I8) sb_printf(sb,"  .byte %d\n",(int)g->initializer->value);
            else sb_printf(sb,"  .quad %d\n",(int)g->initializer->value);
        } else if (g->is_array && g->array_size > 0) {
            int es = ir_type_size(g->type);
            sb_printf(sb,"  .comm %s, %d, 16\n", g->name, g->array_size * es);
        } else {
            sb_printf(sb,"  .comm %s, %d, 4\n", g->name, ir_type_size(g->type));
        }
    }
}

static void gen_func(SB *sb, IRFunction *fn, CallingConvention cc) {
    RegAlloc ra; StackFrame sf;
    ra_init(&ra, cc); sf_init(&sf, cc.stack_alignment);

    sb_printf(sb, ".globl %s\n%s:\n", fn->name, fn->name);

    for (int j = 0; j < fn->num_locals; j++)
        sf_alloc(&sf, fn->locals[j].name, ir_type_size(fn->locals[j].type));

    SB body; sb_init(&body);
    for (int j = 0; j < fn->num_blocks; j++) {
        IRBlock *blk = fn->body[j];
        sb_printf(&body, "%s:\n", blk->label);
        for (int k = 0; k < blk->num_instrs; k++) {
            void *instr = blk->instrs[k];
            IRInstrType tag = *(IRInstrType*)instr;

            if (tag == IR_INSTR) {
                IRInstruction *ii = instr;
                if (ii->opcode == IR_OP_ALLOCA) {
                    int off = sf_alloc(&sf, ii->id, ir_type_size(ii->type));
                    Register *reg = ra_alloc(&ra, ii->id, IR_PTR);
                    if (reg) sb_printf(&body, "  lea %s, [rbp - %d]\n", reg->name, off + 8);
                    continue;
                }
                sel_instr(&body, ii, &ra, &sf, fn);
                for (int o = 0; o < ii->num_operands; o++) {
                    void *op = ii->operands[o];
                    if (!((IRValue*)op)->is_constant) {
                        IRValue *v = op;
                        if (v->id[0]=='t'||strncmp(v->id,"callee",6)==0) ra_free(&ra, v->id);
                    }
                }

            } else if (tag == IR_INSTR_JUMP) {
                sb_printf(&body, "  jmp %s\n", ((IRJump*)instr)->target);
            } else if (tag == IR_INSTR_JUMP_IF) {
                IRJumpIf *j = instr;
                const char *cl = val_loc(&ra, &sf, fn, j->condition->id);
                sb_printf(&body, "  cmp $0, %s\n  jne %s\n  jmp %s\n", cl, j->true_target, j->false_target);
                ra_free(&ra, j->condition->id);
            } else if (tag == IR_INSTR_CALL) {
                IRCall *call = instr;
                int push_count = 0;
                for (int r = 0; r < cc.num_caller_save_regs; r++) {
                    if (strcmp(cc.caller_save_regs[r].name, cc.ret_reg.name) == 0) continue;
                    if (ir_is_floating_point_type(call->type) && strcmp(cc.caller_save_regs[r].name, cc.float_ret_reg.name) == 0) continue;
                    sb_printf(&body, "  push %s\n", cc.caller_save_regs[r].name);
                    push_count++;
                }
                if (push_count % 2 == 1)
                    sb_printf(&body, "  sub $8, rsp\n");
                int ia = 0, fa = 0;
                for (int a = 0; a < call->num_args; a++) {
                    void *arg = call->args[a];
                    IRValue *av = arg;
                    if (ir_is_floating_point_type(av->type)) {
                        if (fa < cc.num_float_arg_regs) {
                            const char *loc = av->is_constant ? op_str(arg,&ra,&sf,fn) : val_loc(&ra,&sf,fn,av->id);
                            const char *mov = av->type==IR_F32?"movss":"movsd";
                            sb_printf(&body, "  %s %s, %s\n", mov, loc, cc.float_arg_regs[fa].name);
                            fa++;
                        }
                    } else {
                        if (ia < cc.num_arg_regs) {
                            const char *loc = av->is_constant ? op_str(arg,&ra,&sf,fn) : val_loc(&ra,&sf,fn,av->id);
                            sb_printf(&body, "  mov %s, %s\n", loc, cc.arg_regs[ia].name);
                            ia++;
                        }
                    }
                }
                sb_printf(&body, "  call %s\n", call->callee);
                if (push_count % 2 == 1)
                    sb_printf(&body, "  add $8, rsp\n");
                for (int r = cc.num_caller_save_regs - 1; r >= 0; r--) {
                    if (strcmp(cc.caller_save_regs[r].name, cc.ret_reg.name) == 0) continue;
                    if (ir_is_floating_point_type(call->type) && strcmp(cc.caller_save_regs[r].name, cc.float_ret_reg.name) == 0) continue;
                    sb_printf(&body, "  pop %s\n", cc.caller_save_regs[r].name);
                }
                if (call->type != IR_VOID) {
                    Register *res = ra_alloc(&ra, call->callee, call->type);
                    const Register *rr = ir_is_floating_point_type(call->type) ? &cc.float_ret_reg : &cc.ret_reg;
                    if (res && strcmp(res->name, rr->name) != 0) {
                        const char *mov = ir_is_floating_point_type(call->type) ? (call->type==IR_F32?"movss":"movsd") : "mov";
                        sb_printf(&body, "  %s %s, %s\n", mov, rr->name, res->name);
                    }
                }
            } else if (tag == IR_INSTR_RET) {
                IRRet *ret = instr;
                if (ret->value) {
                    if (!((IRValue*)ret->value)->is_constant) {
                        IRValue *rv = (IRValue*)ret->value;
                        const char *vl = val_loc(&ra, &sf, fn, rv->id);
                        int isf = ir_is_floating_point_type(rv->type);
                        const Register *rr = isf ? &cc.float_ret_reg : &cc.ret_reg;
                        const char *mov = isf ? (rv->type==IR_F32?"movss":"movsd") : "mov";
                        sb_printf(&body, "  %s %s, %s\n", mov, vl, rr->name);
                    } else {
                        IRConstant *rc = (IRConstant*)ret->value;
                        const Register *rr = ir_is_floating_point_type(rc->type) ? &cc.float_ret_reg : &cc.ret_reg;
                        sb_printf(&body, "  mov $%d, %s\n", (int)rc->value, rr->name);
                    }
                }
                sb_printf(&body, "  add $%d, rsp\n  pop rbp\n  ret\n", sf.total);
            }
        }
    }

    sb_printf(sb, "  push rbp\n  mov rsp, rbp\n");
    if (sf.total > 0) sb_printf(sb, "  sub $%d, rsp\n", sf.total);
    sb_printf(sb, "%s", body.data);
    sb_free(&body);
    ra_free_all(&ra);
}

char *x8664_generate_assembly(IRModule *mod) {
    SB sb; sb_init(&sb);
    gen_data(&sb, mod);
    if (mod->num_functions > 0) {
        sb_printf(&sb, ".text\n");
        for (int i = 0; i < mod->num_functions; i++)
            gen_func(&sb, mod->functions[i], X8664_CC);
    }
    return sb_detach(&sb);
}
