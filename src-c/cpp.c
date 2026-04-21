#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "preprocessor/pp.h"

// Simple CLI for the C preprocessor.
// Usage: cpp [-I<path>] [-D<name>[=value]] < input.c > output.c
// Or:    cpp [-I<path>] [-D<name>[=value]] input.c

int main(int argc, char **argv) {
    const char *include_paths[64];
    int num_include_paths = 0;
    const char *defines[64];
    int num_defines = 0;
    const char *input_file = NULL;

    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "-I", 2) == 0) {
            if (num_include_paths >= 64) {
                fprintf(stderr, "Error: too many include paths (max 64)\n");
                return 1;
            }
            if (argv[i][2] != '\0') {
                include_paths[num_include_paths++] = argv[i] + 2;
            } else if (i + 1 < argc) {
                include_paths[num_include_paths++] = argv[++i];
            }
        } else if (strncmp(argv[i], "-D", 2) == 0) {
            if (num_defines >= 64) {
                fprintf(stderr, "Error: too many defines (max 64)\n");
                return 1;
            }
            if (argv[i][2] != '\0') {
                defines[num_defines++] = argv[i] + 2;
            } else if (i + 1 < argc) {
                defines[num_defines++] = argv[++i];
            }
        } else if (strcmp(argv[i], "-o") == 0) {
            if (i + 1 < argc) {
                if (!freopen(argv[++i], "w", stdout)) {
                    perror("freopen");
                    return 1;
                }
            }
        } else if (argv[i][0] == '-') {
            fprintf(stderr, "Unknown option: %s\n", argv[i]);
            return 1;
        } else {
            input_file = argv[i];
        }
    }

    char *source = NULL;

    if (input_file) {
        FILE *f = fopen(input_file, "rb");
        if (!f) {
            perror(input_file);
            return 1;
        }
        if (fseek(f, 0, SEEK_END) != 0) {
            perror("fseek");
            fclose(f);
            return 1;
        }
        long size = ftell(f);
        if (size < 0) {
            perror("ftell");
            fclose(f);
            return 1;
        }
        fseek(f, 0, SEEK_SET);
        source = malloc((size_t)size + 1);
        if (!source) {
            fclose(f);
            return 1;
        }
        size_t read_bytes = fread(source, 1, (size_t)size, f);
        source[read_bytes] = '\0';
        fclose(f);
    } else {
        // Read from stdin
        size_t cap = 65536;
        source = malloc(cap);
        if (!source) {
            fprintf(stderr, "Out of memory\n");
            return 1;
        }
        size_t len = 0;
        int c;
        while ((c = getchar()) != EOF) {
            if (len + 1 >= cap) {
                size_t new_cap = cap * 2;
                char *new_source = realloc(source, new_cap);
                if (!new_source) {
                    free(source);
                    fprintf(stderr, "Out of memory\n");
                    return 1;
                }
                source = new_source;
                cap = new_cap;
            }
            source[len++] = c;
        }
        source[len] = '\0';
    }

    char *result = preprocess(source, input_file ? input_file : "<stdin>",
                               include_paths, num_include_paths,
                               defines, num_defines);
    free(source);

    if (!result) {
        fprintf(stderr, "Preprocessing failed\n");
        return 1;
    }

    printf("%s", result);
    pp_result_free(result);

    return 0;
}
