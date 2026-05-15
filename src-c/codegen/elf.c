#define _POSIX_C_SOURCE 200809L
#include "elf.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_DATA (1024 * 1024)
#define MAX_INSTR_ENCODED 32
#define MAX_SYMS 512

static void w8(unsigned char *b, size_t *o, unsigned v) { b[(*o)++] = v & 0xFF; }
static void w16(unsigned char *b, size_t *o, unsigned v) {
    b[(*o)++] = v & 0xFF; b[(*o)++] = (v >> 8) & 0xFF;
}
static void w32(unsigned char *b, size_t *o, unsigned v) {
    b[(*o)++] = v & 0xFF; b[(*o)++] = (v >> 8) & 0xFF;
    b[(*o)++] = (v >> 16) & 0xFF; b[(*o)++] = (v >> 24) & 0xFF;
}
static void w64(unsigned char *b, size_t *o, unsigned long v) {
    for (int i = 0; i < 8; i++) { b[(*o)++] = (v >> (i*8)) & 0xFF; }
}

typedef struct {
    char name[128];
    int global;        /* 0=local, 1=global */
    int type;          /* 0=NOTYPE, 1=OBJECT, 2=FUNC */
    int shndx;         /* section index (absolute/register for COMMON) */
    unsigned long value; /* offset within section, or alignment for COMMON */
    unsigned long size;
} SymEntry;

AssemblyProgram *parse_assembly(const char *assembly) {
    AssemblyProgram *prog = calloc(1, sizeof(AssemblyProgram));
    if (!prog) return NULL;
    prog->num_sections = 3;
    prog->sections = calloc(3, sizeof(AssemblySection));
    prog->sections[0].name = strdup(".text");
    prog->sections[0].content = strdup("");
    prog->sections[1].name = strdup(".data");
    prog->sections[1].content = strdup("");
    prog->sections[2].name = strdup(".bss");
    prog->sections[2].content = strdup("");

    const char *p = assembly;
    int cur_sec = -1;

    while (*p) {
        while (*p == '\n' || *p == '\r') { p++; }
        if (!*p) break;

        if (*p == '.') {
            const char *start = p;
            while (*p && *p != '\n') p++;
            size_t len = p - start;
            if (strncmp(start, ".text", 5) == 0 && (len == 5 || start[5] == '\n' || start[5] == '\r')) cur_sec = 0;
            else if (strncmp(start, ".data", 5) == 0 && (len == 5 || start[5] == '\n' || start[5] == '\r')) cur_sec = 1;
            else if (strncmp(start, ".bss", 4) == 0 && (len == 4 || start[4] == '\n' || start[4] == '\r')) cur_sec = 2;
            else if (cur_sec >= 0 && cur_sec < 3) {
                AssemblySection *s = &prog->sections[cur_sec];
                size_t old = strlen(s->content);
                s->content = realloc(s->content, old + len + 2);
                memcpy(s->content + old, start, len);
                s->content[old + len] = '\n';
                s->content[old + len + 1] = '\0';
            }
        } else if (cur_sec >= 0 && cur_sec < 3) {
            const char *start = p;
            while (*p && *p != '\n') p++;
            size_t len = p - start;
            AssemblySection *s = &prog->sections[cur_sec];
            size_t old = strlen(s->content);
            s->content = realloc(s->content, old + len + 2);
            memcpy(s->content + old, start, len);
            s->content[old + len] = '\n';
            s->content[old + len + 1] = '\0';
        } else {
            while (*p && *p != '\n') p++;
        }
    }

    return prog;
}

void free_assembly_program(AssemblyProgram *prog) {
    if (!prog) return;
    for (int i = 0; i < prog->num_sections; i++) {
        free(prog->sections[i].name);
        free(prog->sections[i].content);
    }
    free(prog->sections);
    free(prog);
}

/* ========================================================================
   x86-64 Instruction Encoder
   ======================================================================== */

static int reg_index(const char *name) {
    if (strcmp(name, "rax")==0||strcmp(name,"eax")==0||strcmp(name,"ax")==0||strcmp(name,"al")==0) return 0;
    if (strcmp(name, "rcx")==0||strcmp(name,"ecx")==0||strcmp(name,"cx")==0||strcmp(name,"cl")==0) return 1;
    if (strcmp(name, "rdx")==0||strcmp(name,"edx")==0||strcmp(name,"dx")==0||strcmp(name,"dl")==0) return 2;
    if (strcmp(name, "rbx")==0||strcmp(name,"ebx")==0||strcmp(name,"bx")==0||strcmp(name,"bl")==0) return 3;
    if (strcmp(name, "rsp")==0||strcmp(name,"esp")==0||strcmp(name,"sp")==0||strcmp(name,"spl")==0) return 4;
    if (strcmp(name, "rbp")==0||strcmp(name,"ebp")==0||strcmp(name,"bp")==0||strcmp(name,"bpl")==0) return 5;
    if (strcmp(name, "rsi")==0||strcmp(name,"esi")==0||strcmp(name,"si")==0||strcmp(name,"sil")==0) return 6;
    if (strcmp(name, "rdi")==0||strcmp(name,"edi")==0||strcmp(name,"di")==0||strcmp(name,"dil")==0) return 7;
    if (strcmp(name, "r8")==0||strcmp(name,"r8d")==0||strcmp(name,"r8w")==0||strcmp(name,"r8b")==0) return 0;
    if (strcmp(name, "r9")==0||strcmp(name,"r9d")==0||strcmp(name,"r9w")==0||strcmp(name,"r9b")==0) return 1;
    if (strcmp(name, "r10")==0||strcmp(name,"r10d")==0||strcmp(name,"r10w")==0||strcmp(name,"r10b")==0) return 2;
    if (strcmp(name, "r11")==0||strcmp(name,"r11d")==0||strcmp(name,"r11w")==0||strcmp(name,"r11b")==0) return 3;
    if (strcmp(name, "r12")==0||strcmp(name,"r12d")==0||strcmp(name,"r12w")==0||strcmp(name,"r12b")==0) return 4;
    if (strcmp(name, "r13")==0||strcmp(name,"r13d")==0||strcmp(name,"r13w")==0||strcmp(name,"r13b")==0) return 5;
    if (strcmp(name, "r14")==0||strcmp(name,"r14d")==0||strcmp(name,"r14w")==0||strcmp(name,"r14b")==0) return 6;
    if (strcmp(name, "r15")==0||strcmp(name,"r15d")==0||strcmp(name,"r15w")==0||strcmp(name,"r15b")==0) return 7;
    return -1;
}

static int is_ext_reg(const char *name) {
    return (name[0]=='r' && name[1]>='0' && name[1]<='9');
}

static int modrm(int mod, int reg, int rm) {
    return ((mod & 3) << 6) | ((reg & 7) << 3) | (rm & 7);
}

/* Parse a memory operand like [rbp - 8] or (rax) or [rbp] */
/* Return 1 if parsed, fill *mod, *rm, *disp */
static int parse_mem(const char *s, int *mod, int *rm, int *disp, int *rex_b) {
    const char *p = s;
    while (*p == ' ' || *p == '\t') p++;
    if (*p != '[' && *p != '(') return 0;
    p++;
    while (*p == ' ' || *p == '\t') p++;

    char reg[16]; int ri = 0;
    while (*p && *p != ' ' && *p != '\t' && *p != '-' && *p != '+' && *p != ']' && *p != ')') {
        if (ri < 15) reg[ri++] = *p;
        p++;
    }
    reg[ri] = '\0';

    int idx = reg_index(reg);
    if (idx < 0) return 0;
    *rm = idx;
    *rex_b = is_ext_reg(reg) ? 1 : 0;

    while (*p == ' ' || *p == '\t') p++;

    if (*p == '-' || *p == '+') {
        int sign = (*p == '-') ? -1 : 1;
        p++;
        while (*p == ' ' || *p == '\t') p++;
        int val = 0;
        while (*p >= '0' && *p <= '9') { val = val * 10 + (*p - '0'); p++; }
        *disp = sign * val;
        *mod = 1;
    } else {
        *disp = 0;
        if (idx == 5) { *mod = 0; *disp = 0; }
        else *mod = 0;
    }

    return 1;
}

/* Write REX prefix if needed. Returns bytes written. */
static int emit_rex(unsigned char *buf, int w, int r, int x, int b) {
    if (w || r || x || b) {
        buf[0] = 0x40 | (w ? 8 : 0) | (r ? 4 : 0) | (x ? 2 : 0) | (b ? 1 : 0);
        return 1;
    }
    return 0;
}

/* Encode 2-operand reg-reg or reg-imm instruction for 0x01/0x09/0x21/0x29/0x31 group.
   Format: op src, dst  (AT&T order) */
/* Returns 0 if can't encode, bytes written otherwise */
static int enc_binary_reg_reg(unsigned char *buf, int opcode, const char *src, const char *dst) {
    int sr = reg_index(src);
    int dr = reg_index(dst);
    if (sr < 0 || dr < 0) return 0;
    int rex_w = 1;
    int rex_r = is_ext_reg(src) ? 1 : 0;
    int rex_b = is_ext_reg(dst) ? 1 : 0;
    int pos = 0;
    pos += emit_rex(buf + pos, rex_w, rex_r, 0, rex_b);
    buf[pos++] = opcode;
    buf[pos++] = modrm(3, sr, dr);
    return pos;
}

/* Encode mov reg, r/m64 (0x8B) — used when dst is a register and src might be memory */
static int enc_mov_rm_to_reg(unsigned char *buf, const char *src, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int disp;
    int mod_val, rm, rex_b;
    if (parse_mem(src, &mod_val, &rm, &disp, &rex_b)) {
        if (mod_val == 0 || mod_val == 1) {
            /* [reg] or [reg+disp8] */
            int rex_r = is_ext_reg(dst) ? 1 : 0;
            pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
            buf[pos++] = 0x8B;  /* MOV r64, r/m64 */
            buf[pos++] = modrm(mod_val, dr, rm);
            if (mod_val == 1) buf[pos++] = disp & 0xFF;
            else if (mod_val == 0 && rm == 5) { buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; }
            return pos;
        }
    }
    /* Register-to-register: mov r64, r/m64 (0x8B) reg=dst, r/m=src */
    int sr = reg_index(src);
    rex_b = is_ext_reg(src) ? 1 : 0;
    int rex_r = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
    buf[pos++] = 0x8B;
    buf[pos++] = modrm(3, dr, sr);
    return pos;
}

/* Encode store: mov r/m64, r64 (0x89) — src is reg, dst might be memory */
static int enc_mov_reg_to_rm(unsigned char *buf, const char *src, const char *dst) {
    int sr = reg_index(src);
    if (sr < 0) return 0;
    int pos = 0;
    int disp;
    int mod_val, rm, rex_b;
    if (parse_mem(dst, &mod_val, &rm, &disp, &rex_b)) {
        if (mod_val == 1 || (mod_val == 0)) {
            int rex_r = is_ext_reg(src) ? 1 : 0;
            pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
            buf[pos++] = 0x89;
            buf[pos++] = modrm(mod_val, sr, rm);
            if (mod_val == 1) buf[pos++] = disp & 0xFF;
            else if (mod_val == 0 && rm == 5) { buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; }
            return pos;
        }
    }
    /* Register-to-register: mov r/m64, r64 (0x89) */
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    rex_b = is_ext_reg(dst) ? 1 : 0;
    int rex_r = is_ext_reg(src) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
    buf[pos++] = 0x89;
    buf[pos++] = modrm(3, sr, dr);
    return pos;
}

/* Encode MOV with immediate: mov $imm, dst */
static int enc_mov_imm(unsigned char *buf, int imm, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0xC7;
    buf[pos++] = modrm(3, 0, dr);
    buf[pos++] = imm & 0xFF;
    buf[pos++] = (imm >> 8) & 0xFF;
    buf[pos++] = (imm >> 16) & 0xFF;
    buf[pos++] = (imm >> 24) & 0xFF;
    return pos;
}

/* Encode binary op with immediate: op $imm, dst */
static int enc_bin_imm(unsigned char *buf, int opcode_ext, int imm, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0x83;
    buf[pos++] = modrm(3, opcode_ext, dr);
    buf[pos++] = imm & 0xFF;
    return pos;
}

/* Encode shift by imm8: shl/shr $N, dst */
static int enc_shift_imm(unsigned char *buf, int opcode_ext, int imm, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0xC1;
    buf[pos++] = modrm(3, opcode_ext, dr);
    buf[pos++] = imm & 0xFF;
    return pos;
}

/* Encode shift by cl: shl/shr cl, dst */
static int enc_shift_cl(unsigned char *buf, int opcode_ext, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0xD3;
    buf[pos++] = modrm(3, opcode_ext, dr);
    return pos;
}

/* Encode IDIV: idiv src */
static int enc_idiv(unsigned char *buf, const char *src) {
    int sr = reg_index(src);
    if (sr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(src) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0xF7;
    buf[pos++] = modrm(3, 7, sr);
    return pos;
}

/* Encode CQO */
static int enc_cqo(unsigned char *buf) {
    buf[0] = 0x48; buf[1] = 0x99;
    return 2;
}

/* Encode unary: neg/not dst */
static int enc_unary(unsigned char *buf, int opcode_ext, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0xF7;
    buf[pos++] = modrm(3, opcode_ext, dr);
    return pos;
}

/* Encode PUSH */
static int enc_push(unsigned char *buf, const char *reg) {
    int idx = reg_index(reg);
    if (idx < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(reg) ? 1 : 0;
    pos += emit_rex(buf + pos, 0, 0, 0, ext);
    buf[pos++] = 0x50 + idx;
    return pos;
}

/* Encode POP */
static int enc_pop(unsigned char *buf, const char *reg) {
    int idx = reg_index(reg);
    if (idx < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(reg) ? 1 : 0;
    pos += emit_rex(buf + pos, 0, 0, 0, ext);
    buf[pos++] = 0x58 + idx;
    return pos;
}

/* Encode CMP reg, imm8: cmp dst, $imm (AT&T: cmp src, dst → compute dst - src) */
static int enc_cmp_imm(unsigned char *buf, const char *dst, int imm) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, 0, 0, ext);
    buf[pos++] = 0x83;
    buf[pos++] = modrm(3, 7, dr);
    buf[pos++] = imm & 0xFF;
    return pos;
}

/* Encode CMP reg, reg: cmp src, dst */
static int enc_cmp_reg(unsigned char *buf, const char *src, const char *dst) {
    int sr = reg_index(src);
    int dr = reg_index(dst);
    if (sr < 0 || dr < 0) return 0;
    int pos = 0;
    int rex_r = is_ext_reg(src) ? 1 : 0;
    int rex_b = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
    buf[pos++] = 0x39;
    buf[pos++] = modrm(3, sr, dr);
    return pos;
}

/* Encode SETcc: setcc dst (8-bit register) */
static int enc_setcc(unsigned char *buf, int cc, const char *dst) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int pos = 0;
    int ext = is_ext_reg(dst) ? 1 : 0;
    /* For SETcc, we need a REX prefix if dst is extended or if it's SIL/DIL/BPL/SPL.
       Since we use rax/rcx etc which have legacy byte regs (AL/CL/DL/BL), no REX needed
       for those. But for extended regs (r8b+), we need REX.B. */
    if (ext || dr >= 4) {
        /* For SPL(4), BPL(5), SIL(6), DIL(7) we need REX to access low byte */
        pos += emit_rex(buf + pos, 0, 0, 0, ext);
    }
    buf[pos++] = 0x0F;
    buf[pos++] = 0x90 | (cc & 0xF);
    buf[pos++] = modrm(3, 0, dr);
    return pos;
}

/* Encode LEA: lea dst, [base+disp8] */
static int enc_lea(unsigned char *buf, const char *dst, const char *mem) {
    int dr = reg_index(dst);
    if (dr < 0) return 0;
    int mod_val, rm, disp, rex_b;
    if (!parse_mem(mem, &mod_val, &rm, &disp, &rex_b)) return 0;
    int pos = 0;
    int rex_r = is_ext_reg(dst) ? 1 : 0;
    pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
    buf[pos++] = 0x8D;
    buf[pos++] = modrm(mod_val, dr, rm);
    if (mod_val == 1) buf[pos++] = disp & 0xFF;
    return pos;
}

/* Tokenize an instruction line into parts */
static int tokenize(const char *line, char **parts, int max_parts) {
    int np = 0;
    const char *p = line;
    while (*p && np < max_parts) {
        while (*p == ' ' || *p == '\t') p++;
        if (!*p) break;
        const char *start = p;
        if (*p == '$') {
            p++;
            while (*p >= '0' && *p <= '9') p++;
            int len = p - start;
            parts[np] = malloc(len + 1);
            memcpy(parts[np], start, len);
            parts[np][len] = '\0';
            np++;
        } else if (*p == '[' || *p == '(') {
            /* Memory operand: read until matching bracket */
            int depth = 1;
            p++;
            while (*p && depth > 0) {
                if (*p == '[' || *p == '(') depth++;
                else if (*p == ']' || *p == ')') depth--;
                p++;
            }
            int len = p - start;
            parts[np] = malloc(len + 1);
            memcpy(parts[np], start, len);
            parts[np][len] = '\0';
            np++;
        } else if (*p == ',') {
            p++;
        } else if (*p == ':') {
            p++;
            int len = p - start;
            parts[np] = malloc(len + 1);
            memcpy(parts[np], start, len);
            parts[np][len] = '\0';
            np++;
            break; /* Label found */
        } else {
            while (*p && *p != ' ' && *p != '\t' && *p != ',' && *p != ':' && *p != '\n' && *p != '\r') p++;
            int len = p - start;
            parts[np] = malloc(len + 1);
            memcpy(parts[np], start, len);
            parts[np][len] = '\0';
            np++;
        }
    }
    return np;
}

static void free_tokens(char **parts, int np) {
    for (int i = 0; i < np; i++) free(parts[i]);
}

/* Compare operator to opcode extension and condition code table */
typedef struct { const char *name; int opcode_op; int cc; int op_ext; } OpEntry;

/* Encode one assembly line into bytes. Returns bytes written, or <0 for label, or 0 for skip/directive. */
static int encode_instruction(unsigned char *buf, const char *line) {
    char *parts[8];
    int np = tokenize(line, parts, 8);
    if (np == 0) { free_tokens(parts, np); return 0; }

    const char *op = parts[0];
    int result = -1; /* negative means error/try next */

    /* Label */
    if (op[strlen(op)-1] == ':') { free_tokens(parts, np); return -1; }

    /* Directive: .globl, .align, .type, etc. */
    if (op[0] == '.') { free_tokens(parts, np); return 0; }

    /* mov $imm, dst */
    if (strcmp(op, "mov") == 0 && np >= 3 && parts[1][0] == '$') {
        int imm = atoi(parts[1] + 1);
        result = enc_mov_imm(buf, imm, parts[2]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* mov src, dst — register or memory */
    if (strcmp(op, "mov") == 0 && np >= 3) {
        /* Check if destination is memory */
        if (parts[2][0] == '[' || parts[2][0] == '(') {
            /* Store: mov src, [mem] — use 0x89 */
            result = enc_mov_reg_to_rm(buf, parts[1], parts[2]);
        } else if (parts[1][0] == '[' || parts[1][0] == '(') {
            /* Load: mov [mem], dst — use 0x8B */
            result = enc_mov_rm_to_reg(buf, parts[1], parts[2]);
        } else {
            /* Reg to reg: try 0x89 first */
            result = enc_binary_reg_reg(buf, 0x89, parts[1], parts[2]);
        }
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* add/sub/and/or/xor src, dst — 0x01/0x29/0x21/0x09/0x31 */
    {
        int opc = 0;
        int op_ext = -1;
        if (strcmp(op, "add")==0) { opc = 0x01; op_ext = 0; }
        else if (strcmp(op, "sub")==0) { opc = 0x29; op_ext = 5; }
        else if (strcmp(op, "imul")==0) { opc = -1; } /* special handling */
        else if (strcmp(op, "and")==0) { opc = 0x21; op_ext = 4; }
        else if (strcmp(op, "or")==0) { opc = 0x09; op_ext = 1; }
        else if (strcmp(op, "xor")==0) { opc = 0x31; op_ext = 6; }

        if (opc > 0 && np >= 3) {
            if (parts[1][0] == '$') {
                result = enc_bin_imm(buf, op_ext, atoi(parts[1] + 1), parts[2]);
            } else {
                result = enc_binary_reg_reg(buf, opc, parts[1], parts[2]);
            }
            if (result > 0) { free_tokens(parts, np); return result; }
        }

        /* imul src, dst — use 0x0F AF /r (IMUL r64, r/m64) */
        if (strcmp(op, "imul") == 0 && np >= 3) {
            int dr = reg_index(parts[2]);
            if (dr >= 0) {
                int sr = reg_index(parts[1]);
                if (sr >= 0) {
                    int pos = 0;
                    int rex_r = is_ext_reg(parts[2]) ? 1 : 0;
                    int rex_b = is_ext_reg(parts[1]) ? 1 : 0;
                    pos += emit_rex(buf + pos, 1, rex_r, 0, rex_b);
                    buf[pos++] = 0x0F;
                    buf[pos++] = 0xAF;
                    buf[pos++] = modrm(3, dr, sr);
                    free_tokens(parts, np);
                    return pos;
                }
            }
        }
    }

    /* cmp src, dst (or cmp dst, $imm) */
    if (strcmp(op, "cmp") == 0 && np >= 3) {
        if (parts[2][0] == '$') {
            result = enc_cmp_imm(buf, parts[1], atoi(parts[2] + 1));
        } else {
            result = enc_cmp_reg(buf, parts[1], parts[2]);
        }
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* setcc dst */
    if (np >= 2 && op[0]=='s' && op[1]=='e' && op[2]=='t') {
        static const char *cc_names[] = {"o","no","b","ae","e","ne","be","a","s","ns","p","np","l","ge","le","g"};
        int cc = -1;
        const char *cond = op + 3;
        for (int i = 0; i < 16; i++) {
            if (strcmp(cond, cc_names[i]) == 0) { cc = i; break; }
        }
        if (cc >= 0) {
            result = enc_setcc(buf, cc, parts[1]);
            if (result > 0) { free_tokens(parts, np); return result; }
        }
    }

    /* push/pop reg */
    if (strcmp(op, "push") == 0 && np >= 2) {
        result = enc_push(buf, parts[1]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }
    if (strcmp(op, "pop") == 0 && np >= 2) {
        result = enc_pop(buf, parts[1]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* ret */
    if (strcmp(op, "ret") == 0) {
        buf[0] = 0xC3;
        free_tokens(parts, np);
        return 1;
    }

    /* cqo */
    if (strcmp(op, "cqo") == 0) {
        result = enc_cqo(buf);
        free_tokens(parts, np);
        return result;
    }

    /* idiv src */
    if (strcmp(op, "idiv") == 0 && np >= 2) {
        result = enc_idiv(buf, parts[1]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* neg/not dst */
    if ((strcmp(op, "neg") == 0 || strcmp(op, "not") == 0) && np >= 2) {
        int ext = (strcmp(op, "neg") == 0) ? 3 : 2;
        result = enc_unary(buf, ext, parts[1]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* shl/shr $imm, dst */
    if ((strcmp(op, "shl") == 0 || strcmp(op, "shr") == 0) && np >= 3) {
        int ext = (strcmp(op, "shl") == 0) ? 4 : 5;
        if (parts[1][0] == '$') {
            result = enc_shift_imm(buf, ext, atoi(parts[1] + 1), parts[2]);
        } else {
            result = enc_shift_cl(buf, ext, parts[2]);
        }
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* lea dst, src */
    if (strcmp(op, "lea") == 0 && np >= 3) {
        result = enc_lea(buf, parts[1], parts[2]);
        if (result > 0) { free_tokens(parts, np); return result; }
    }

    /* jmp/jne/je/call with label — use near forms, return negative offset to indicate fixup needed */
    if ((strcmp(op, "jmp") == 0 || strcmp(op, "je") == 0 ||
         strcmp(op, "jne") == 0 || strcmp(op, "jl") == 0 ||
         strcmp(op, "jle") == 0 || strcmp(op, "jg") == 0 ||
         strcmp(op, "jge") == 0 || strcmp(op, "jb") == 0 ||
         strcmp(op, "jae") == 0 || strcmp(op, "jbe") == 0 ||
         strcmp(op, "ja") == 0 || strcmp(op, "js") == 0 ||
         strcmp(op, "jns") == 0 || strcmp(op, "jp") == 0 ||
         strcmp(op, "jnp") == 0 || strcmp(op, "jo") == 0 ||
         strcmp(op, "jno") == 0) && np >= 2) {
        /* Store jump target name and return -2 to indicate fixup needed */
        /* Format for near jmp: 0xE9 rel32 (5 bytes) */
        /* For conditional: 0x0F 8x rel32 (6 bytes) */
        int is_jmp = (strcmp(op, "jmp") == 0);
        int pos = 0;
        int cc = -1;
        if (!is_jmp) {
            static const char *jcc_names[] = {"jo","jno","jb","jae","je","jne","jbe","ja","js","jns","jp","jnp","jl","jge","jle","jg"};
            for (int i = 0; i < 16; i++) {
                if (strcmp(op, jcc_names[i]) == 0) { cc = i; break; }
            }
        }
        if (is_jmp) {
            buf[pos++] = 0xE9;
            /* rel32 placeholder */
            buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0;
        } else if (cc >= 0) {
            buf[pos++] = 0x0F;
            buf[pos++] = 0x80 | cc;
            buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0; buf[pos++] = 0;
        }
        if (pos > 0) {
            /* Store the label name for fixup — we return a special code.
               We'll encode it with the target name encoded by storing the index
               to the label table. For now, just return negative bytes to indicate
               a jump that needs fixup, with the offset for the rel32 field. */
            free_tokens(parts, np);
            /* Return negative of total bytes so caller can detect this as a jump */
            return -pos; /* negated so caller knows it needs fixup */
        }
    }

    /* call label — use 0xE8 rel32 (5 bytes) */
    if (strcmp(op, "call") == 0 && np >= 2) {
        buf[0] = 0xE8;
        buf[1] = 0; buf[2] = 0; buf[3] = 0; buf[4] = 0;
        free_tokens(parts, np);
        return -5; /* negative indicates fixup needed */
    }

    /* Unknown instruction — skip */
    free_tokens(parts, np);
    return 0;
}

/* Label table */
typedef struct {
    char  name[128];
    int   offset;  /* byte offset in encoded text section */
} Label;

/* Encode a full text section. Each line that is a jump/call (with negative return) 
   gets its target looked up in the labels table. We need two passes.
   If syms is non-NULL, collect symbol entries for .globl'd labels. */
static unsigned char *encode_text_section(const char *content, size_t *out_len,
                                          SymEntry *syms, int *nsym, int text_shndx) {
    Label labels[512];
    int num_labels = 0;
    int globl_next[512]; /* names that are preceded by .globl */
    int num_globl = 0;
    for (int i = 0; i < 512; i++) globl_next[i] = 0;

    /* Instead of two-pass, we'll collect jump fixup info */
    typedef struct {
        int   pos;     /* byte position of the rel32 field */
        int   size;    /* total size of the jump instruction (5 or 6) */
        char  target[128];
    } JumpFixup;

    JumpFixup fixups[512];
    int num_fixups = 0;

    /* First, split content into lines */
    char *copy = strdup(content);
    char *lines[4096];
    int num_lines = 0;
    char *save = NULL;
    char *tok = strtok_r(copy, "\n", &save);
    while (tok && num_lines < 4096) {
        lines[num_lines++] = tok;
        tok = strtok_r(NULL, "\n", &save);
    }

    /* Allocate a buffer for encoded text */
    unsigned char *buf = calloc(MAX_DATA, 1);
    size_t off = 0;

    /* First pass: encode everything, record labels and fixup positions */
    for (int i = 0; i < num_lines; i++) {
        char *line = lines[i];
        while (*line == ' ' || *line == '\t') line++;
        if (!*line) continue;

        /* Check for .globl directive */
        if (strncmp(line, ".globl", 6) == 0) {
            const char *gn = line + 6;
            while (*gn == ' ' || *gn == '\t') gn++;
            if (*gn && num_globl < 512) {
                strncpy(labels[num_globl].name, gn, 127);
                labels[num_globl].name[127] = '\0';
                globl_next[num_globl] = 1;
                /* Check if name ends at newline (removed by tokenization) */
                char *end = labels[num_globl].name;
                while (*end && *end != '\n' && *end != '\r') end++;
                *end = '\0';
                num_globl++;
            }
            continue;
        }

        /* Check for label: ends with ':' */
        if (line[strlen(line)-1] == ':') {
            char name[128];
            size_t nl = strlen(line);
            if (nl > 0 && line[nl-1] == ':') {
                size_t cplen = nl - 1;
                if (cplen > 127) cplen = 127;
                memcpy(name, line, cplen);
                name[cplen] = '\0';
                if (num_labels < 512) {
                    labels[num_labels].offset = off;
                    strncpy(labels[num_labels].name, name, 127);
                    labels[num_labels].name[127] = '\0';
                    num_labels++;
                }
                /* Check if this label was .globl'd */
                if (syms && *nsym < MAX_SYMS) {
                    for (int gi = 0; gi < num_globl; gi++) {
                        if (globl_next[gi] && strcmp(labels[num_labels-1].name, labels[gi].name) == 0) {
                            SymEntry *e = &syms[*nsym];
                            strncpy(e->name, name, 127);
                            e->name[127] = '\0';
                            e->global = 1;
                            e->type = 2; /* STT_FUNC */
                            e->shndx = text_shndx;
                            e->value = off;
                            e->size = 0;
                            globl_next[gi] = 0;
                            (*nsym)++;
                            break;
                        }
                    }
                }
            }
            continue;
        }

        /* Skip other directives */
        if (line[0] == '.') continue;

        /* Encode the instruction */
        unsigned char enc[MAX_INSTR_ENCODED];
        int ret = encode_instruction(enc, line);

        if (ret > 0) {
            /* Normal instruction */
            memcpy(buf + off, enc, ret);
            off += ret;
        } else if (ret < 0) {
            /* Jump/call instruction — write placeholder (keep opcode, zero rel32) */
            int bytes_needed = -ret;
            memcpy(buf + off, enc, bytes_needed);
            if (num_fixups < 512) {
                fixups[num_fixups].pos = off;
                fixups[num_fixups].size = bytes_needed;
                /* Extract target from the line (last part) */
                char *parts[8];
                int np = tokenize(line, parts, 8);
                if (np >= 2) {
                    strncpy(fixups[num_fixups].target, parts[np-1], 127);
                    fixups[num_fixups].target[127] = '\0';
                }
                free_tokens(parts, np);
                num_fixups++;
            }
            off += bytes_needed;
        }
        /* ret == 0 means skip/directive/label */
    }

    /* Second pass: resolve jump/call fixups */
    for (int i = 0; i < num_fixups; i++) {
        JumpFixup *jf = &fixups[i];
        int target_offset = -1;
        for (int j = 0; j < num_labels; j++) {
            if (strcmp(labels[j].name, jf->target) == 0) {
                target_offset = labels[j].offset;
                break;
            }
        }
        if (target_offset >= 0) {
            int rel32 = target_offset - (jf->pos + jf->size);
            /* Write rel32 at the appropriate offset within the instruction */
            if (jf->size == 5) {
                /* JMP rel32: E9 rel32 — rel32 starts at jf->pos + 1 */
                buf[jf->pos + 1] = rel32 & 0xFF;
                buf[jf->pos + 2] = (rel32 >> 8) & 0xFF;
                buf[jf->pos + 3] = (rel32 >> 16) & 0xFF;
                buf[jf->pos + 4] = (rel32 >> 24) & 0xFF;
            } else if (jf->size == 6) {
                /* Jcc rel32: 0F 8x rel32 — rel32 starts at jf->pos + 2 */
                buf[jf->pos + 2] = rel32 & 0xFF;
                buf[jf->pos + 3] = (rel32 >> 8) & 0xFF;
                buf[jf->pos + 4] = (rel32 >> 16) & 0xFF;
                buf[jf->pos + 5] = (rel32 >> 24) & 0xFF;
            }
            /* For call E8 rel32: rel32 starts at jf->pos + 1 (size=5) */
        }
    }

    free(copy);
    *out_len = off;
    return buf;
}

static size_t data_line_size(const char *line) {
    const char *p = line;
    while (*p == ' ' || *p == '\t') p++;
    if (strncmp(p, ".long", 5) == 0) return 4;
    if (strncmp(p, ".byte", 5) == 0) return 1;
    if (strncmp(p, ".quad", 5) == 0) return 8;
    if (strncmp(p, ".zero", 5) == 0) {
        p += 5; while (*p == ' ' || *p == '\t') p++;
        return (size_t)atoi(p);
    }
    if (strncmp(p, ".ascii", 6) == 0 || strncmp(p, ".asciz", 6) == 0 || strncmp(p, ".string", 7) == 0) {
        /* Skip past directive name */
        p = line;
        while (*p == ' ' || *p == '\t') p++;
        while (*p && *p != ' ' && *p != '\t') p++;
        while (*p == ' ' || *p == '\t') p++;
        if (*p == '"') {
            size_t slen = 0;
            p++;
            while (*p && *p != '"') { slen++; p++; }
            return strncmp(line, ".asciz", 6) == 0 || strncmp(line, ".string", 7) == 0 ? slen + 1 : slen;
        }
        return 0;
    }
    return 0;
}

static void encode_data_line(const char *line, unsigned char *buf, size_t *off) {
    const char *p = line;
    while (*p == ' ' || *p == '\t') p++;

    if (strncmp(p, ".long", 5) == 0) {
        p += 5; while (*p == ' ' || *p == '\t') p++;
        int v = atoi(p);
        w32(buf, off, (unsigned)v);
    } else if (strncmp(p, ".byte", 5) == 0) {
        p += 5; while (*p == ' ' || *p == '\t') p++;
        w8(buf, off, (unsigned)atoi(p));
    } else if (strncmp(p, ".quad", 5) == 0) {
        p += 5; while (*p == ' ' || *p == '\t') p++;
        w64(buf, off, (unsigned long)atol(p));
    } else if (strncmp(p, ".zero", 5) == 0) {
        p += 5; while (*p == ' ' || *p == '\t') p++;
        int nz = atoi(p);
        memset(buf + *off, 0, nz);
        *off += nz;
    }
}

static size_t count_bss_size(const char *content) {
    size_t total = 0;
    const char *p = content;
    while (*p) {
        if (strncmp(p, ".comm", 5) == 0) {
            const char *comma = strchr(p + 5, ',');
            if (comma) {
                comma++;
                while (*comma == ' ') comma++;
                long sz = strtol(comma, NULL, 10);
                total += sz;
            }
        }
        const char *nl = strchr(p, '\n');
        if (!nl) break;
        p = nl + 1;
    }
    return total;
}

unsigned char *generate_elf(AssemblyProgram *prog, const char *arch, size_t *out_len) {
    (void)arch;
    unsigned char *buf = calloc(MAX_DATA, 1);
    size_t off = 0;
    size_t shoff_pos, shoff;

    int has_text = 0, has_data = 0, has_bss = 0;
    size_t text_sz = 0, data_sz = 0, bss_sz = 0;
    unsigned char *text_data = NULL;

    for (int i = 0; i < 3 && i < prog->num_sections; i++) {
        if (strcmp(prog->sections[i].name, ".text") == 0 && strlen(prog->sections[i].content) > 0)
            has_text = 1;
        if (strcmp(prog->sections[i].name, ".data") == 0 && strlen(prog->sections[i].content) > 0)
            has_data = 1;
        if (strcmp(prog->sections[i].name, ".bss") == 0) {
            bss_sz = count_bss_size(prog->sections[i].content);
            has_bss = (bss_sz > 0);
        }
    }

    /* Collect symbols */
    SymEntry syms[MAX_SYMS];
    int nsym = 0;

    /* Encode text section (x86-64 only; ARM64 uses raw text for now) */
    int is_x86_64 = (strcmp(arch, "x86-64") == 0 || strcmp(arch, "x86_64") == 0);
    if (has_text) {
        for (int i = 0; i < 3 && i < prog->num_sections; i++) {
            if (strcmp(prog->sections[i].name, ".text") == 0) {
                if (is_x86_64) {
                    text_data = encode_text_section(prog->sections[i].content, &text_sz, syms, &nsym, 1);
                } else {
                    text_sz = strlen(prog->sections[i].content);
                    /* Collect text symbols from raw assembly */
                    const char *tp = prog->sections[i].content;
                    char raw_globl[128] = "";
                    while (*tp) {
                        const char *nl = strchr(tp, '\n');
                        if (!nl) nl = tp + strlen(tp);
                        size_t tllen = nl - tp;
                        char *tline = strndup(tp, tllen);
                        char *tt = tline;
                        while (*tt == ' ' || *tt == '\t') tt++;
                        if (strncmp(tt, ".globl", 6) == 0) {
                            const char *gn = tt + 6;
                            while (*gn == ' ' || *gn == '\t') gn++;
                            strncpy(raw_globl, gn, 127);
                            raw_globl[127] = '\0';
                            char *e = raw_globl + strlen(raw_globl) - 1;
                            while (e >= raw_globl && (*e == ' ' || *e == '\t' || *e == '\n' || *e == '\r')) *e-- = '\0';
                        } else if (tt[strlen(tt)-1] == ':') {
                            size_t cplen = strlen(tt) - 1;
                            if (cplen > 127) cplen = 127;
                            char lname[128];
                            memcpy(lname, tt, cplen);
                            lname[cplen] = '\0';
                            if (strcmp(lname, raw_globl) == 0 && nsym < MAX_SYMS) {
                                SymEntry *e = &syms[nsym];
                                strncpy(e->name, lname, 127); e->name[127] = '\0';
                                e->global = 1; e->type = 2; e->shndx = 1;
                                /* Compute offset: raw byte position in text content */
                                e->value = (unsigned long)(tp - prog->sections[i].content);
                                e->size = 0;
                                nsym++;
                                raw_globl[0] = '\0';
                            }
                        }
                        free(tline);
                        tp = nl + 1;
                    }
                }
                break;
            }
        }
    }

    /* Calculate data section size */
    for (int i = 0; i < 3 && i < prog->num_sections; i++) {
        if (strcmp(prog->sections[i].name, ".data") == 0) {
            unsigned char *tmp = calloc(MAX_DATA, 1);
            size_t tmp_off = 0;
            const char *p = prog->sections[i].content;
            while (*p) {
                const char *nl = strchr(p, '\n');
                if (!nl) nl = p + strlen(p);
                char *line = strndup(p, nl - p);
                encode_data_line(line, tmp, &tmp_off);
                free(line);
                p = nl + 1;
            }
            data_sz = tmp_off;
            free(tmp);
        }
    }

    /* Collect data and bss symbols */
    {
        /* Data section: .globl directives followed by labels */
        size_t data_off = 0;
        for (int i = 0; i < 3 && i < prog->num_sections; i++) {
            if (strcmp(prog->sections[i].name, ".data") != 0) continue;
            const char *dp = prog->sections[i].content;
            char data_globl_name[128] = "";
            while (*dp) {
                const char *nl = strchr(dp, '\n');
                if (!nl) nl = dp + strlen(dp);
                size_t llen = nl - dp;
                char *line = strndup(dp, llen);
                /* Trim */
                char *lt = line;
                while (*lt == ' ' || *lt == '\t') lt++;
                if (lt[0] == '.') {
                    if (strncmp(lt, ".globl", 6) == 0) {
                        const char *gn = lt + 6;
                        while (*gn == ' ' || *gn == '\t') gn++;
                        strncpy(data_globl_name, gn, 127);
                        data_globl_name[127] = '\0';
                        /* Trim trailing spaces/newlines */
                        char *e = data_globl_name + strlen(data_globl_name) - 1;
                        while (e >= data_globl_name && (*e == ' ' || *e == '\t' || *e == '\n' || *e == '\r')) *e-- = '\0';
                    } else {
                        /* Other directives advance offset */
                        data_off += data_line_size(lt);
                    }
                } else if (lt[strlen(lt)-1] == ':') {
                    char lname[128];
                    size_t ln = strlen(lt);
                    if (ln > 0 && lt[ln-1] == ':') {
                        size_t cplen = ln - 1;
                        if (cplen > 127) cplen = 127;
                        memcpy(lname, lt, cplen);
                        lname[cplen] = '\0';
                        if (strcmp(lname, data_globl_name) == 0 && nsym < MAX_SYMS) {
                            SymEntry *e = &syms[nsym];
                            strncpy(e->name, lname, 127);
                            e->name[127] = '\0';
                            e->global = 1;
                            e->type = 1; /* STT_OBJECT */
                            e->shndx = 0; /* set after we know indices */
                            e->value = data_off;
                            e->size = 0;
                            nsym++;
                            data_globl_name[0] = '\0';
                        }
                    }
                }
                free(line);
                dp = nl + 1;
            }
        }
        /* BSS section: .comm directives */
        for (int i = 0; i < 3 && i < prog->num_sections; i++) {
            if (strcmp(prog->sections[i].name, ".bss") != 0) continue;
            const char *bp = prog->sections[i].content;
            while (*bp) {
                if (strncmp(bp, ".comm", 5) == 0) {
                    const char *p = bp + 5;
                    while (*p == ' ' || *p == '\t') p++;
                    char name[128]; int ni = 0;
                    while (*p && *p != ',' && *p != ' ' && *p != '\t' && ni < 127) name[ni++] = *p++;
                    name[ni] = '\0';
                    while (*p && *p != ',') p++;
                    if (*p == ',') p++;
                    while (*p == ' ') p++;
                    long sz = strtol(p, NULL, 10);
                    while (*p && *p != ',') p++;
                    long align = 4;
                    if (*p == ',') {
                        p++;
                        while (*p == ' ') p++;
                        align = strtol(p, NULL, 10);
                    }
                    if (nsym < MAX_SYMS) {
                        SymEntry *e = &syms[nsym];
                        strncpy(e->name, name, 127);
                        e->name[127] = '\0';
                        e->global = 1;
                        e->type = 1; /* STT_OBJECT */
                        e->shndx = 0xFFF2; /* SHN_COMMON */
                        e->value = align;
                        e->size = sz;
                        nsym++;
                    }
                }
                const char *nl = strchr(bp, '\n');
                if (!nl) break;
                bp = nl + 1;
            }
        }
    }

    /* Compute section indices */
    int sec_text = -1, sec_data = -1, sec_strtab;
    int si = 0;
    si++; /* NULL */
    if (has_text) { sec_text = si; si++; }
    if (has_data) { sec_data = si; si++; }
    if (has_bss)  { si++; }
    si++; /* .symtab */
    sec_strtab   = si++;
    si++; /* .shstrtab */
    int nsec = si; /* total section count */

    /* Fix up data symbol section indices (they were set speculatively above) */
    for (int i = 0; i < nsym; i++) {
        if (syms[i].shndx == 0) {
            /* Determine section index from section name stored elsewhere — 
               data symbols have value=offset, need sec_data */
            if (sec_data >= 0) syms[i].shndx = sec_data;
            else if (sec_text >= 0) syms[i].shndx = sec_text;
        }
    }

    /* ELF header */
    w8(buf, &off, 0x7F); w8(buf, &off, 'E'); w8(buf, &off, 'L'); w8(buf, &off, 'F');
    w8(buf, &off, 2);  /* 64-bit */
    w8(buf, &off, 1);  /* LE */
    w8(buf, &off, 1);  /* version */
    w8(buf, &off, 0);  /* OS/ABI */
    w8(buf, &off, 0);  /* ABI ver */
    for (int i = 0; i < 7; i++) w8(buf, &off, 0);

    w16(buf, &off, 1);  /* ET_REL */
    {
        unsigned machine = 0x3E; /* EM_X86_64 */
        if (strcmp(arch, "arm64") == 0 || strcmp(arch, "aarch64") == 0)
            machine = 0xB7; /* EM_AARCH64 */
        w16(buf, &off, machine);
    }
    w32(buf, &off, 1);  /* version */
    w64(buf, &off, 0);  /* entry */
    w64(buf, &off, 0);  /* phoff */
    shoff_pos = off;
    w64(buf, &off, 0);  /* placeholder shoff */
    w32(buf, &off, 0);  /* flags */
    w16(buf, &off, 64); /* ehsize */
    w16(buf, &off, 0);  /* phentsize */
    w16(buf, &off, 0);  /* phnum */
    w16(buf, &off, 64); /* shentsize */
    w16(buf, &off, nsec); /* shnum */
    size_t shstrndx_pos = off;
    w16(buf, &off, 0);  /* placeholder shstrndx */

    /* Section data */
    size_t text_file_off = 0, data_file_off = 0;

    if (has_text) {
        text_file_off = off;
        if (is_x86_64 && text_data) {
            memcpy(buf + off, text_data, text_sz);
            off += text_sz;
        } else if (!is_x86_64) {
            for (int i = 0; i < 3 && i < prog->num_sections; i++) {
                if (strcmp(prog->sections[i].name, ".text") == 0) {
                    memcpy(buf + off, prog->sections[i].content, text_sz);
                    off += text_sz;
                    break;
                }
            }
        }
    }
    if (has_data) {
        data_file_off = off;
        for (int i = 0; i < 3 && i < prog->num_sections; i++) {
            if (strcmp(prog->sections[i].name, ".data") == 0) {
                const char *p = prog->sections[i].content;
                while (*p) {
                    const char *nl = strchr(p, '\n');
                    if (!nl) nl = p + strlen(p);
                    char *line = strndup(p, nl - p);
                    encode_data_line(line, buf, &off);
                    free(line);
                    p = nl + 1;
                }
            }
        }
    }

    /* Build .strtab content */
    char strtab[4096];
    size_t stro = 0;
    strtab[stro++] = '\0';
    int sym_name_offsets[MAX_SYMS];
    for (int i = 0; i < nsym && i < MAX_SYMS; i++) {
        sym_name_offsets[i] = stro;
        size_t nlen = strlen(syms[i].name);
        memcpy(strtab + stro, syms[i].name, nlen);
        stro += nlen;
        strtab[stro++] = '\0';
    }

    /* .symtab data */
    size_t symtab_file_off = off;
    /* Null symbol (index 0) */
    w32(buf, &off, 0); w8(buf, &off, 0); w8(buf, &off, 0);
    w16(buf, &off, 0); w64(buf, &off, 0); w64(buf, &off, 0);
    /* Regular symbols */
    for (int i = 0; i < nsym; i++) {
        w32(buf, &off, sym_name_offsets[i]);
        w8(buf, &off, (syms[i].global ? 0x10 : 0) | (syms[i].type & 0x0F));
        w8(buf, &off, 0);
        w16(buf, &off, syms[i].shndx);
        w64(buf, &off, syms[i].value);
        w64(buf, &off, syms[i].size);
    }
    size_t symtab_sz = off - symtab_file_off;

    /* .strtab data */
    size_t strtab_file_off = off;
    memcpy(buf + off, strtab, stro);
    off += stro;
    size_t strtab_sz = stro;

    shoff = off;

    /* Build section header string table (.shstrtab content) */
    char sht[128];
    size_t sho = 0;
    int name_off_text = -1, name_off_data = -1, name_off_bss = -1;
    int name_off_symtab = -1, name_off_strtab = -1, name_off_shstrtab = -1;

    sht[sho++] = '\0';
    if (has_text) { name_off_text = sho; memcpy(sht+sho,".text",5); sho+=5; sht[sho++]='\0'; }
    if (has_data) { name_off_data = sho; memcpy(sht+sho,".data",5); sho+=5; sht[sho++]='\0'; }
    if (has_bss)  { name_off_bss  = sho; memcpy(sht+sho,".bss",4);  sho+=4; sht[sho++]='\0'; }
    name_off_symtab  = sho; memcpy(sht+sho,".symtab",7);  sho+=7; sht[sho++]='\0';
    name_off_strtab  = sho; memcpy(sht+sho,".strtab",7);  sho+=7; sht[sho++]='\0';
    name_off_shstrtab = sho; memcpy(sht+sho,".shstrtab",9); sho+=9; sht[sho++]='\0';

    size_t sht_sz = sho;

    /* Section headers */
    int sec_idx = 0;
    /* Null */
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    sec_idx++;

    if (has_text) {
        w32(buf, &off, name_off_text);
        w32(buf, &off, 1); /* SHT_PROGBITS */
        w64(buf, &off, 6); /* ALLOC + EXEC */
        w64(buf, &off, 0);
        w64(buf, &off, text_file_off);
        w64(buf, &off, text_sz);
        w32(buf, &off, 0); w32(buf, &off, 0);
        w64(buf, &off, 16); w64(buf, &off, 0);
        sec_idx++;
    }
    if (has_data) {
        w32(buf, &off, name_off_data);
        w32(buf, &off, 1); /* SHT_PROGBITS */
        w64(buf, &off, 3); /* ALLOC + WRITE */
        w64(buf, &off, 0);
        w64(buf, &off, data_file_off);
        w64(buf, &off, data_sz);
        w32(buf, &off, 0); w32(buf, &off, 0);
        w64(buf, &off, 16); w64(buf, &off, 0);
        sec_idx++;
    }
    if (has_bss) {
        w32(buf, &off, name_off_bss);
        w32(buf, &off, 8); /* SHT_NOBITS */
        w64(buf, &off, 3); /* ALLOC + WRITE */
        w64(buf, &off, 0);
        w64(buf, &off, 0);
        w64(buf, &off, bss_sz);
        w32(buf, &off, 0); w32(buf, &off, 0);
        w64(buf, &off, 16); w64(buf, &off, 0);
        sec_idx++;
    }

    /* .symtab */
    w32(buf, &off, name_off_symtab);
    w32(buf, &off, 2); /* SHT_SYMTAB */
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, symtab_file_off);
    w64(buf, &off, symtab_sz);
    w32(buf, &off, sec_strtab); /* sh_link */
    w32(buf, &off, 1);           /* sh_info: 1 local symbol (the null symbol) */
    w64(buf, &off, 8);
    w64(buf, &off, 24); /* sh_entsize */
    sec_idx++;

    /* .strtab */
    w32(buf, &off, name_off_strtab);
    w32(buf, &off, 3); /* SHT_STRTAB */
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, strtab_file_off);
    w64(buf, &off, strtab_sz);
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 1); w64(buf, &off, 0);
    sec_idx++;

    /* .shstrtab */
    w32(buf, &off, name_off_shstrtab);
    w32(buf, &off, 3); /* SHT_STRTAB */
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, shoff + nsec * 64); /* after all section headers */
    w64(buf, &off, sht_sz);
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 1); w64(buf, &off, 0);

    /* Write .shstrtab content */
    memcpy(buf + off, sht, sht_sz);
    off += sht_sz;

    /* Fixup shoff and shstrndx */
    size_t tmp_off = shoff_pos;
    w64(buf, &tmp_off, shoff);
    tmp_off = shstrndx_pos;
    w16(buf, &tmp_off, nsec - 1);

    *out_len = off;

    if (text_data) free(text_data);

    return buf;
}
