#ifndef ELF_H
#define ELF_H

#include <stddef.h>

typedef struct {
    char       *name;
    char       *content;
    size_t      content_len;
} AssemblySection;

typedef struct {
    AssemblySection *sections;
    int              num_sections;
} AssemblyProgram;

AssemblyProgram *parse_assembly(const char *assembly);
void free_assembly_program(AssemblyProgram *prog);
unsigned char *generate_elf(AssemblyProgram *prog, const char *arch, size_t *out_len);

#endif
