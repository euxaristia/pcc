#ifndef IRGEN_H
#define IRGEN_H

#include "ir.h"
#include "../parser/parser.h"

/* ========================================================================
   IR Generator: converts AST to IRModule
   ======================================================================== */

typedef struct IRGenerator IRGenerator;

IRGenerator *irgen_create(void);
void         irgen_free(IRGenerator *gen);
IRModule    *irgen_generate(IRGenerator *gen, ASTNode *program);

/* Pretty print the generated IR */
char        *irgen_pretty_print(IRModule *mod);

#endif /* IRGEN_H */
