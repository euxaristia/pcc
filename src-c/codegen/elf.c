#define _POSIX_C_SOURCE 200809L
#include "elf.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_DATA (1024 * 1024)

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
                /* Add line to current section */
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

static size_t encode_data_section(const char *content) {
    unsigned char *buf = calloc(MAX_DATA, 1);
    size_t off = 0;

    const char *p = content;
    while (*p) {
        const char *nl = strchr(p, '\n');
        if (!nl) nl = p + strlen(p);
        char *line = strndup(p, nl - p);
        encode_data_line(line, buf, &off);
        free(line);
        p = nl + 1;
    }

    size_t len = off;
    memmove(buf, buf, len); /* shrink actually keep the allocated */
    free(buf); /* We only need the length, not the data */
    return len;
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

    int nsec = 1 + has_text + has_data + has_bss + 1; /* null + sections + shstrtab */

    /* Calculate section data sizes */
    for (int i = 0; i < 3 && i < prog->num_sections; i++) {
        if (strcmp(prog->sections[i].name, ".text") == 0)
            text_sz = strlen(prog->sections[i].content);
        if (strcmp(prog->sections[i].name, ".data") == 0)
            data_sz = encode_data_section(prog->sections[i].content);
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
    w16(buf, &off, 0x3E); /* x86-64 */
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
        /* For now, text section is just the asm text content */
        const char *tc = NULL;
        for (int i = 0; i < 3 && i < prog->num_sections; i++)
            if (strcmp(prog->sections[i].name, ".text") == 0)
                tc = prog->sections[i].content;
        if (tc) {
            size_t tlen = strlen(tc);
            memcpy(buf + off, tc, tlen);
            off += tlen;
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
    if (has_bss) {
        /* BSS has no file data */
    }

    shoff = off;

    /* Section header string table */
    char sht[64];
    size_t sho = 0;
    sht[sho++] = '\0';
    if (has_text) { memcpy(sht + sho, ".text", 5); sho += 5; sht[sho++] = '\0'; }
    if (has_data) { memcpy(sht + sho, ".data", 5); sho += 5; sht[sho++] = '\0'; }
    if (has_bss)  { memcpy(sht + sho, ".bss", 4);  sho += 4; sht[sho++] = '\0'; }
    memcpy(sht + sho, ".shstrtab", 9); sho += 9; sht[sho++] = '\0';

    /* Section headers */
    int sec_idx = 0;
    /* Null */
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 0); w64(buf, &off, 0);
    sec_idx++;

    size_t name_off = 1;

    if (has_text) {
        w32(buf, &off, name_off); name_off += 6;
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
        w32(buf, &off, name_off); name_off += 6;
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
        w32(buf, &off, name_off); name_off += 5;
        w32(buf, &off, 8); /* SHT_NOBITS */
        w64(buf, &off, 3); /* ALLOC + WRITE */
        w64(buf, &off, 0);
        w64(buf, &off, 0);
        w64(buf, &off, bss_sz);
        w32(buf, &off, 0); w32(buf, &off, 0);
        w64(buf, &off, 16); w64(buf, &off, 0);
        sec_idx++;
    }

    /* .shstrtab */
    w32(buf, &off, name_off);
    w32(buf, &off, 3); /* SHT_STRTAB */
    w64(buf, &off, 0); w64(buf, &off, 0);
    w64(buf, &off, off + (nsec - sec_idx) * 64); /* offset after all section headers */
    size_t sht_sz = sho;
    w64(buf, &off, sht_sz);
    w32(buf, &off, 0); w32(buf, &off, 0);
    w64(buf, &off, 1); w64(buf, &off, 0);

    /* Write string table */
    memcpy(buf + off, sht, sht_sz);
    off += sht_sz;

    /* Fixup shoff and shstrndx */
    size_t tmp_off = shoff_pos;
    w64(buf, &tmp_off, shoff);
    tmp_off = shstrndx_pos;
    w16(buf, &tmp_off, nsec - 1);

    *out_len = off;
    return buf;
}
