#ifndef TARGET_H
#define TARGET_H

#include "ir.h"

#define MAX_CALLER_SAVE 20
#define MAX_CALLEE_SAVE 12
#define MAX_FLOAT_CALLER_SAVE 16
#define MAX_ARG_REGS 8
#define MAX_FLOAT_ARG_REGS 8

typedef struct {
    const char *name;
    int number;
    int caller_save;
    int argument;
    int is_xmm;
} Register;

typedef struct {
    Register arg_regs[MAX_ARG_REGS];
    int num_arg_regs;
    Register float_arg_regs[MAX_FLOAT_ARG_REGS];
    int num_float_arg_regs;
    Register caller_save_regs[MAX_CALLER_SAVE];
    int num_caller_save_regs;
    Register float_caller_save_regs[MAX_FLOAT_CALLER_SAVE];
    int num_float_caller_save_regs;
    Register callee_save_regs[MAX_CALLEE_SAVE];
    int num_callee_save_regs;
    Register ret_reg;
    Register float_ret_reg;
    int stack_alignment;
} CallingConvention;

extern const CallingConvention X8664_CC;
extern const CallingConvention ARM64_CC;

const CallingConvention *get_calling_convention(const char *arch);

#endif
