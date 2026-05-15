#define _POSIX_C_SOURCE 200809L
#include "asmgen_arm64.h"
#include "target.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

typedef struct { char *d; size_t l; size_t c; } SB;
static void sb_init(SB *s) { memset(s,0,sizeof(*s)); }
static void sb_free(SB *s) { free(s->d); s->d=NULL; s->l=s->c=0; }
static void sb_ap(SB *s, const char *str) {
    size_t sl = strlen(str);
    if (s->l + sl + 1 > s->c) {
        size_t nc = s->c ? s->c*2 : 4096;
        while (s->l+sl+1 > nc) nc*=2;
        char *p = realloc(s->d, nc);
        if (!p) { fprintf(stderr,"OOM\n"); exit(1); }
        s->d=p; s->c=nc;
    }
    memcpy(s->d+s->l, str, sl);
    s->l+=sl; s->d[s->l]='\0';
}
static void sb_p(SB *s, const char *f, ...) {
    char b[4096]; va_list ap;
    va_start(ap,f); vsnprintf(b,sizeof(b),f,ap); va_end(ap);
    sb_ap(s,b);
}
static char *sb_det(SB *s) {
    char *r = s->d ? s->d : strdup(""); s->d=NULL; s->l=s->c=0; return r;
}

typedef struct { char *vid; Register reg; int used; } AE;
typedef struct { AE e[64]; int n; CallingConvention cc; } AA;
static void aa_init(AA *a, CallingConvention cc) { memset(a,0,sizeof(*a)); a->cc=cc; }
static Register *aa_alloc(AA *a, const char *id, IRType ty) {
    if (a->n >= 64) return NULL;
    int isf = ir_is_floating_point_type(ty);
    int n = isf ? a->cc.num_float_caller_save_regs : a->cc.num_caller_save_regs;
    const Register *rs = isf ? a->cc.float_caller_save_regs : a->cc.caller_save_regs;
    for (int i=0;i<n;i++) { int tk=0;
        for (int j=0;j<a->n;j++) if (a->e[j].used&&strcmp(a->e[j].reg.name,rs[i].name)==0){tk=1;break;}
        if (!tk) { AE *e=&a->e[a->n++]; e->vid=strdup(id); e->reg=rs[i]; e->used=1; return &e->reg; }
    } return NULL;
}
static Register *aa_get(AA *a, const char *id) {
    for (int i=0;i<a->n;i++) if (a->e[i].used&&strcmp(a->e[i].vid,id)==0) return &a->e[i].reg;
    return NULL;
}
static void aa_free(AA *a, const char *id) {
    for (int i=0;i<a->n;i++) if (a->e[i].used&&strcmp(a->e[i].vid,id)==0){free(a->e[i].vid);a->e[i].used=0;break;}
}
static void aa_free_all(AA *a) { for (int i=0;i<a->n;i++) if (a->e[i].used) free(a->e[i].vid); a->n=0; }

typedef struct { char n[128]; int o; int sz; } AS;
typedef struct { AS s[256]; int num; int tot; int al; } AF;
static void af_init(AF *f, int a) { memset(f,0,sizeof(*f)); f->al=a; }
static int af_alloc(AF *f, const char *name, int sz) {
    if (f->num >= 256) return -1;
    AS *s=&f->s[f->num++]; snprintf(s->n,sizeof(s->n),"%s",name); s->o=f->tot; s->sz=sz;
    f->tot+=sz; if (f->tot%f->al) f->tot+=f->al-(f->tot%f->al); return s->o;
}
static AS *af_get(AF *f, const char *name) {
    for (int i=0;i<f->num;i++) if (strcmp(f->s[i].n,name)==0) return &f->s[i];
    return NULL;
}

static const char *vl(AA *a, AF *f, IRFunction *fn, const char *id) {
    Register *r = aa_get(a,id); if (r) return r->name;
    AS *s = af_get(f,id); if (s) {
        static char b[2][64]; static int p=0; p=(p+1)%2;
        snprintf(b[p],sizeof(b[p]),"[x29, #%d]",s->o); return b[p];
    }
    for (int i=0;i<fn->num_params;i++) if (strcmp(fn->params[i].name,id)==0) {
        if (ir_is_floating_point_type(fn->params[i].type)) { if (i<a->cc.num_float_arg_regs) return a->cc.float_arg_regs[i].name; }
        else { if (i<a->cc.num_arg_regs) return a->cc.arg_regs[i].name; }
    }
    return id;
}

static const char *os(void *op, AA *a, AF *f, IRFunction *fn) {
    IRValue *v=op; if (v->is_constant) {
        static char b[2][32]; static int p=0; p=(p+1)%2;
        snprintf(b[p],sizeof(b[p]),"#%d",(int)((IRConstant*)op)->value); return b[p];
    } return vl(a,f,fn,v->id);
}

static void ab(SB *s, const char *mn, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<2) return;
    const char *l=os(ii->operands[0],a,f,fn), *r=os(ii->operands[1],a,f,fn);
    Register *res=aa_alloc(a,ii->id,ii->type); if (!res) return;
    sb_p(s,"  mov %s, %s\n  %s %s, %s, %s\n",res->name,l,mn,res->name,res->name,r);
}
static void ac(SB *s, const char *cc, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<2) return;
    const char *l=os(ii->operands[0],a,f,fn), *r=os(ii->operands[1],a,f,fn);
    Register *res=aa_alloc(a,ii->id,ii->type); if (!res) return;
    sb_p(s,"  cmp %s, %s\n  cset %s, %s\n",l,r,res->name,cc);
}
static void au(SB *s, const char *mn, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<1) return;
    const char *op=os(ii->operands[0],a,f,fn);
    Register *res=aa_alloc(a,ii->id,ii->type); if (!res) return;
    sb_p(s,"  mov %s, %s\n  %s %s, %s\n",res->name,op,mn,res->name,res->name);
}
static void am(SB *s, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<1) return;
    const char *op=os(ii->operands[0],a,f,fn);
    Register *res=aa_alloc(a,ii->id,ii->type); if (!res) return;
    sb_p(s,"  mov %s, %s\n",res->name,op);
}
static void al(SB *s, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<1) return;
    const char *addr=os(ii->operands[0],a,f,fn);
    Register *res=aa_alloc(a,ii->id,ii->type); if (!res) return;
    if (ir_is_floating_point_type(ii->type)) {
        const char *sz=ii->type==IR_F32?"s":"d";
        sb_p(s,"  ldr %s.%s, [%s]\n",res->name,sz,addr);
    } else if (ii->type==IR_I64||ii->type==IR_PTR) sb_p(s,"  ldr %s, [%s]\n",res->name,addr);
    else sb_p(s,"  ldr %s.w, [%s]\n",res->name,addr);
}
static void as(SB *s, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    if (ii->num_operands<2) return;
    const char *val=os(ii->operands[0],a,f,fn), *addr=os(ii->operands[1],a,f,fn);
    int isf=ir_is_floating_point_type(((IRValue*)ii->operands[0])->type);
    if (isf) { const char *sz=((IRValue*)ii->operands[0])->type==IR_F32?"s":"d";
        sb_p(s,"  str %s.%s, [%s]\n",val,sz,addr);
    } else if (((IRValue*)ii->operands[0])->type==IR_I64||((IRValue*)ii->operands[0])->type==IR_PTR)
        sb_p(s,"  str %s, [%s]\n",val,addr);
    else sb_p(s,"  str %s.w, [%s]\n",val,addr);
}
static void asel(SB *s, IRInstruction *ii, AA *a, AF *f, IRFunction *fn) {
    switch (ii->opcode) {
    case IR_OP_ADD:  ab(s,"add",ii,a,f,fn); break;
    case IR_OP_SUB:  ab(s,"sub",ii,a,f,fn); break;
    case IR_OP_MUL:  ab(s,"mul",ii,a,f,fn); break;
    case IR_OP_DIV:  ab(s,"sdiv",ii,a,f,fn); break;
    case IR_OP_SHL:  ab(s,"lsl",ii,a,f,fn); break;
    case IR_OP_SHR:  ab(s,"lsr",ii,a,f,fn); break;
    case IR_OP_BAND: ab(s,"and",ii,a,f,fn); break;
    case IR_OP_BOR:  ab(s,"orr",ii,a,f,fn); break;
    case IR_OP_BXOR: ab(s,"eor",ii,a,f,fn); break;
    case IR_OP_BNOT: au(s,"mvn",ii,a,f,fn); break;
    case IR_OP_EQ:   ac(s,"eq",ii,a,f,fn); break;
    case IR_OP_NE:   ac(s,"ne",ii,a,f,fn); break;
    case IR_OP_LT:   ac(s,"lt",ii,a,f,fn); break;
    case IR_OP_LE:   ac(s,"le",ii,a,f,fn); break;
    case IR_OP_GT:   ac(s,"gt",ii,a,f,fn); break;
    case IR_OP_GE:   ac(s,"ge",ii,a,f,fn); break;
    case IR_OP_AND:  ab(s,"and",ii,a,f,fn); break;
    case IR_OP_OR:   ab(s,"orr",ii,a,f,fn); break;
    case IR_OP_NOT:  au(s,"mvn",ii,a,f,fn); break;
    case IR_OP_NEG:  au(s,"neg",ii,a,f,fn); break;
    case IR_OP_MOV:  am(s,ii,a,f,fn); break;
    case IR_OP_LOAD: al(s,ii,a,f,fn); break;
    case IR_OP_STORE:as(s,ii,a,f,fn); break;
    case IR_OP_ALLOCA: break;
    default: break;
    }
}

char *arm64_generate_assembly(IRModule *mod) {
    SB sb; sb_init(&sb);
    const CallingConvention *cc = &ARM64_CC;

    if (mod->num_globals>0) {
        sb_p(&sb,".data\n");
        for (int i=0;i<mod->num_globals;i++) {
            IRGlobal *g=mod->globals[i];
            sb_p(&sb,"  .globl %s\n  .align 4\n  %s:\n",g->name,g->name);
            if (g->initializer) {
                if (g->type==IR_I32||g->type==IR_F32) sb_p(&sb,"  .word %d\n",(int)g->initializer->value);
                else if (g->type==IR_I8) sb_p(&sb,"  .byte %d\n",(int)g->initializer->value);
                else sb_p(&sb,"  .quad %d\n",(int)g->initializer->value);
            } else if (g->is_array&&g->array_size>0) {
                sb_p(&sb,"  .comm %s, %d, 16\n",g->name,g->array_size*ir_type_size(g->type));
            } else sb_p(&sb,"  .comm %s, %d, 4\n",g->name,ir_type_size(g->type));
        }
    }

    if (mod->num_functions>0) {
        sb_p(&sb,".text\n");
        for (int i=0;i<mod->num_functions;i++) {
            IRFunction *fn=mod->functions[i];
            AA a; aa_init(&a,*cc); AF f; af_init(&f,cc->stack_alignment);
            sb_p(&sb,".globl %s\n%s:\n",fn->name,fn->name);
            for (int j=0;j<fn->num_locals;j++) af_alloc(&f,fn->locals[j].name,ir_type_size(fn->locals[j].type));
            SB body; sb_init(&body);
            for (int j=0;j<fn->num_blocks;j++) {
                IRBlock *blk=fn->body[j]; sb_p(&body,"%s:\n",blk->label);
                for (int k=0;k<blk->num_instrs;k++) {
                    void *instr=blk->instrs[k];
                    IRInstrType tag=*(IRInstrType*)instr;
                    if (tag==IR_INSTR) {
                        IRInstruction *ii=instr;
                        if (ii->opcode==IR_OP_ALLOCA) {
                            int off=af_alloc(&f,ii->id,ir_type_size(ii->type));
                            Register *reg=aa_alloc(&a,ii->id,IR_PTR);
                            if (reg) sb_p(&body,"  add %s, x29, #%d\n",reg->name,off);
                            continue;
                        }
                        asel(&body,ii,&a,&f,fn);
                        for (int o=0;o<ii->num_operands;o++) { void *op=ii->operands[o];
                            if (!((IRValue*)op)->is_constant) { IRValue *v=op;
                                if (v->id[0]=='t'||strncmp(v->id,"callee",6)==0) aa_free(&a,v->id); } }
                        if (ii->opcode!=IR_OP_LOAD) aa_free(&a,ii->id);
                    } else if (tag==IR_INSTR_JUMP) {
                        sb_p(&body,"  b %s\n",((IRJump*)instr)->target);
                    } else if (tag==IR_INSTR_JUMP_IF) {
                        IRJumpIf *j=instr;
                        const char *cl=vl(&a,&f,fn,j->condition->id);
                        sb_p(&body,"  cmp %s, #0\n  b.ne %s\n  b %s\n",cl,j->true_target,j->false_target);
                        aa_free(&a,j->condition->id);
                    } else if (tag==IR_INSTR_CALL) {
                        IRCall *call=instr;
                        for (int r=0;r<cc->num_caller_save_regs;r++)
                            sb_p(&body,"  str %s, [sp, #-16]!\n",cc->caller_save_regs[r].name);
                        int ia=0,fa=0;
                        for (int a2=0;a2<call->num_args;a2++) { void *arg=call->args[a2]; IRValue *av=arg;
                            if (ir_is_floating_point_type(av->type)) {
                                if (fa<cc->num_float_arg_regs) {
                                    const char *loc=av->is_constant?os(arg,&a,&f,fn):vl(&a,&f,fn,av->id);
                                    sb_p(&body,"  fmov %s, %s\n",cc->float_arg_regs[fa].name,loc); fa++;
                                }
                            } else { if (ia<cc->num_arg_regs) {
                                const char *loc=av->is_constant?os(arg,&a,&f,fn):vl(&a,&f,fn,av->id);
                                sb_p(&body,"  mov %s, %s\n",cc->arg_regs[ia].name,loc); ia++; } }
                        }
                        sb_p(&body,"  bl %s\n",call->callee);
                        if (call->type!=IR_VOID) {
                            Register *res=aa_alloc(&a,call->callee,call->type);
                            const Register *rr=ir_is_floating_point_type(call->type)?&cc->float_ret_reg:&cc->ret_reg;
                            if (res&&strcmp(res->name,rr->name)!=0) sb_p(&body,"  mov %s, %s\n",res->name,rr->name);
                        }
                    } else if (tag==IR_INSTR_RET) {
                        IRRet *ret=instr;
                        int st=f.tot, al=((st+16)/16)*16;
                        if (ret->value) {
                            const Register *rr=ir_is_floating_point_type(((IRValue*)ret->value)->type)?&cc->float_ret_reg:&cc->ret_reg;
                            if (!((IRValue*)ret->value)->is_constant) {
                                const char *vl2=vl(&a,&f,fn,((IRValue*)ret->value)->id);
                                sb_p(&body,"  mov %s, %s\n",rr->name,vl2);
                            } else sb_p(&body,"  mov %s, #%d\n",rr->name,(int)((IRConstant*)ret->value)->value);
                        }
                        sb_p(&body,"  ldp x29, x30, [sp], #%d\n  ret\n",al);
                    }
                }
            }
            int st=f.tot, al=((st+16)/16)*16;
            sb_p(&sb,"  stp x29, x30, [sp, #-%d]!\n  mov x29, sp\n",al);
            sb_p(&sb,"%s",body.d); sb_free(&body); aa_free_all(&a);
        }
    }
    return sb_det(&sb);
}
