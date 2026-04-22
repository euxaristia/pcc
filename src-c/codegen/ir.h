#ifndef IR_H
#define IR_H

/* ========================================================================
   Intermediate Representation (IR) data structures
   ======================================================================== */

typedef enum {
    IR_OP_ADD, IR_OP_SUB, IR_OP_MUL, IR_OP_DIV, IR_OP_MOD,
    IR_OP_SHL, IR_OP_SHR,
    IR_OP_BAND, IR_OP_BOR, IR_OP_BXOR, IR_OP_BNOT,
    IR_OP_EQ, IR_OP_NE, IR_OP_LT, IR_OP_LE, IR_OP_GT, IR_OP_GE,
    IR_OP_AND, IR_OP_OR, IR_OP_NOT,
    IR_OP_LOAD, IR_OP_STORE, IR_OP_ALLOCA,
    IR_OP_JUMP, IR_OP_JUMP_IF, IR_OP_CALL, IR_OP_RET, IR_OP_PHI,
    IR_OP_ASM,
    IR_OP_TRUNC, IR_OP_ZEXT, IR_OP_SEXT,
    IR_OP_NEG, IR_OP_MOV,
} IROpCode;

typedef enum {
    IR_I8, IR_I16, IR_I32, IR_I64,
    IR_F32, IR_F64,
    IR_VOID, IR_PTR,
} IRType;

typedef struct IRValue {
    int      is_constant;  /* 0 for IRValue */
    char    *id;
    IRType   type;
} IRValue;

typedef struct IRConstant {
    int      is_constant;  /* 1 for IRConstant */
    double   value;  /* Use double to hold any numeric type */
    IRType   type;
} IRConstant;

/* Forward declarations */
typedef struct IRInstruction IRInstruction;
typedef struct IRJump IRJump;
typedef struct IRJumpIf IRJumpIf;
typedef struct IRCall IRCall;
typedef struct IRRet IRRet;

typedef enum {
    IR_INSTR,
    IR_INSTR_JUMP,
    IR_INSTR_JUMP_IF,
    IR_INSTR_CALL,
    IR_INSTR_RET,
} IRInstrType;

typedef struct IRInstruction {
    IRInstrType tag;
    char       *id;
    IROpCode    opcode;
    IRType      type;
    int         num_operands;
    void      **operands;  /* IRValue* or IRConstant* */
} IRInstruction;

typedef struct IRJump {
    IRInstrType tag;
    char       *target;
} IRJump;

typedef struct IRJumpIf {
    IRInstrType tag;
    IRValue    *condition;
    char       *true_target;
    char       *false_target;
} IRJumpIf;

typedef struct IRCall {
    IRInstrType tag;
    char       *callee;
    IRType      type;
    int         num_args;
    void      **args;  /* IRValue* or IRConstant* */
} IRCall;

typedef struct IRRet {
    IRInstrType tag;
    IRType      type;
    void       *value;  /* IRValue* or IRConstant* or NULL */
} IRRet;

typedef struct IRBlock {
    char       *label;
    int         num_instrs;
    int         cap_instrs;
    void      **instrs;  /* IRInstruction* | IRJump* | IRJumpIf* | IRCall* | IRRet* */
} IRBlock;

typedef struct IRParam {
    char       *name;
    IRType      type;
} IRParam;

typedef struct IRLocal {
    char       *name;
    IRType      type;
} IRLocal;

typedef struct IRFunction {
    char       *name;
    IRType      return_type;
    int         num_params;
    IRParam    *params;
    int         num_locals;
    IRLocal    *locals;
    int         num_blocks;
    int         cap_blocks;
    IRBlock   **body;
} IRFunction;

typedef struct IRGlobal {
    char       *name;
    IRType      type;
    IRConstant *initializer;      /* NULL if no initializer */
    IRConstant **array_init;      /* NULL if not array */
    int         array_size;
    int         is_array;
} IRGlobal;

typedef struct IRModule {
    int         num_functions;
    int         cap_functions;
    IRFunction **functions;
    int         num_globals;
    int         cap_globals;
    IRGlobal   **globals;
} IRModule;

/* ========================================================================
   Utility functions
   ======================================================================== */

const char *ir_opcode_name(IROpCode op);
const char *ir_type_name(IRType type);
int ir_type_size(IRType type);
int ir_is_pointer_type(IRType type);
int ir_is_integer_type(IRType type);

IRValue    *ir_create_value(const char *id, IRType type);
IRConstant *ir_create_constant(double value, IRType type);
IRInstruction *ir_create_instruction(const char *id, IROpCode opcode, IRType type);
IRJump     *ir_create_jump(const char *target);
IRJumpIf   *ir_create_jump_if(IRValue *condition, const char *true_target, const char *false_target);
IRCall     *ir_create_call(const char *callee, IRType type);
IRRet      *ir_create_ret(IRType type, void *value);

void ir_block_add_instr(IRBlock *block, void *instr);
void ir_function_add_block(IRFunction *func, IRBlock *block);
void ir_function_add_local(IRFunction *func, const char *name, IRType type);
void ir_module_add_function(IRModule *mod, IRFunction *func);
void ir_module_add_global(IRModule *mod, IRGlobal *global);

IRModule   *ir_module_create(void);
void        ir_module_free(IRModule *mod);

/* Pretty print for debugging/testing */
char       *ir_pretty_print(IRModule *mod);

#endif /* IR_H */
