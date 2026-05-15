#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int tests_run = 0;
static int tests_passed = 0;
static int tests_failed = 0;
static int current_test_failed = 0;

#define TEST(name) static void test_##name(void)
#define RUN(name) do { \
    tests_run++; \
    printf("  test_" #name " ... "); \
    fflush(stdout); \
    current_test_failed = 0; \
    test_##name(); \
    if (!current_test_failed) { \
        tests_passed++; \
        printf("PASS\n"); \
    } \
} while(0)

#define FAIL(msg) do { \
    if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
    printf("FAIL: %s\n", msg); \
    return; \
} while(0)

#define ASSERT(cond) do { \
    if (!(cond)) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: assertion failed: %s\n", #cond); \
        return; \
    } \
} while(0)

static int run_pcc(const char *args) {
    char cmd[4096];
    snprintf(cmd, sizeof(cmd), "./pcc %s 2>/dev/null", args);
    return system(cmd);
}

static int run_pcc_stderr(const char *args, char *output, size_t out_size) {
    char cmd[4096];
    snprintf(cmd, sizeof(cmd), "./pcc %s 2>&1", args);
    FILE *f = popen(cmd, "r");
    if (!f) return -1;
    size_t n = fread(output, 1, out_size - 1, f);
    output[n] = '\0';
    return pclose(f);
}

static void write_file(const char *path, const char *content) {
    FILE *f = fopen(path, "w");
    if (!f) { FAIL("cannot write temp file"); return; }
    fprintf(f, "%s", content);
    fclose(f);
}

TEST(help_flag) {
    char out[4096];
    int rc = run_pcc_stderr("--help", out, sizeof(out));
    ASSERT(rc != -1);
    ASSERT(strstr(out, "Usage") != NULL || strstr(out, "pcc") != NULL);
}

TEST(no_input_error) {
    int rc = run_pcc("");
    ASSERT(rc != 0);
}

TEST(compile_to_object) {
    write_file("/tmp/cli_test.c", "int main(void) { return 42; }\n");
    int rc = run_pcc("/tmp/cli_test.c -o /tmp/cli_test.o");
    ASSERT(rc == 0);
    FILE *f = fopen("/tmp/cli_test.o", "rb");
    ASSERT(f != NULL);
    fclose(f);
    remove("/tmp/cli_test.o");
}

TEST(emit_assembly_S) {
    write_file("/tmp/cli_test.c", "int main(void) { return 42; }\n");
    int rc = run_pcc("/tmp/cli_test.c -S -o /tmp/cli_test.s");
    ASSERT(rc == 0);
    FILE *f = fopen("/tmp/cli_test.s", "rb");
    ASSERT(f != NULL);
    fclose(f);
    remove("/tmp/cli_test.s");
}

TEST(emit_preprocess_E) {
    write_file("/tmp/cli_test.c", "#define X 42\nint main(void) { return X; }\n");
    int rc = run_pcc("/tmp/cli_test.c -E");
    ASSERT(rc == 0);
}

TEST(macro_define_D) {
    write_file("/tmp/cli_test.c", "int main(void) { return VALUE; }\n");
    int rc = run_pcc("-DVALUE=42 /tmp/cli_test.c -o /tmp/cli_test.o");
    ASSERT(rc == 0);
    remove("/tmp/cli_test.o");
}

TEST(include_path_I) {
    system("mkdir -p /tmp/cli_inc");
    write_file("/tmp/cli_inc/myheader.h", "#define X 99\n");
    write_file("/tmp/cli_test.c", "#include \"myheader.h\"\nint main(void) { return X; }\n");
    int rc = run_pcc("-I/tmp/cli_inc /tmp/cli_test.c -o /tmp/cli_test.o");
    ASSERT(rc == 0);
    remove("/tmp/cli_test.o");
    remove("/tmp/cli_inc/myheader.h");
}

TEST(verbose_flag) {
    char out[4096];
    int rc = run_pcc_stderr("--verbose /tmp/cli_test.c 2>&1", out, sizeof(out));
    (void)rc;
    /* Should print phase info */
    ASSERT(strstr(out, "Compiling") != NULL || strstr(out, "Phase") != NULL);
}

TEST(werror_flag) {
    write_file("/tmp/cli_test.c", "int main(void) { return 42; }\n");
    int rc = run_pcc("-Werror /tmp/cli_test.c -o /tmp/cli_test.o");
    ASSERT(rc == 0);
    remove("/tmp/cli_test.o");
}

TEST(arch_arm64) {
    write_file("/tmp/cli_test.c", "int main(void) { return 42; }\n");
    int rc = run_pcc("--arch=arm64 /tmp/cli_test.c -o /tmp/cli_test.o");
    ASSERT(rc == 0);
    remove("/tmp/cli_test.o");
}

int main(void) {
    printf("Running C CLI tests...\n\n");

    RUN(help_flag);
    RUN(no_input_error);
    RUN(compile_to_object);
    RUN(emit_assembly_S);
    RUN(emit_preprocess_E);
    RUN(macro_define_D);
    RUN(include_path_I);
    RUN(verbose_flag);
    RUN(werror_flag);
    RUN(arch_arm64);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n", tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    remove("/tmp/cli_test.c");
    return tests_failed > 0 ? 1 : 0;
}
