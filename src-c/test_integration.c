#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

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

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        if (!current_test_failed) { current_test_failed = 1; tests_failed++; } \
        printf("FAIL: expected %d, got %d\n", (int)(b), (int)(a)); \
        return; \
    } \
} while(0)

static void write_file(const char *path, const char *content) {
    FILE *f = fopen(path, "w");
    if (!f) { printf("FAIL: cannot write %s\n", path); exit(1); }
    fprintf(f, "%s", content);
    fclose(f);
}

static int compile_and_link(const char *src_path, const char *out_path) {
    char obj_path[1024];
    snprintf(obj_path, sizeof(obj_path), "%s.o", out_path);
    char cmd[4096];
    snprintf(cmd, sizeof(cmd), "./pcc %s -o %s 2>/dev/null", src_path, obj_path);
    int rc = system(cmd);
    if (rc == -1 || !WIFEXITED(rc) || WEXITSTATUS(rc) != 0) return 1;
    snprintf(cmd, sizeof(cmd), "x86_64-linux-gnu-gcc -static %s -o %s 2>/dev/null", obj_path, out_path);
    rc = system(cmd);
    remove(obj_path);
    return (rc == -1 || !WIFEXITED(rc) || WEXITSTATUS(rc) != 0) ? 1 : 0;
}

static int run_prog(const char *path) {
    char cmd[4096];
    snprintf(cmd, sizeof(cmd), "qemu-x86_64 %s; echo \"__EXIT_$?\"", path);
    FILE *f = popen(cmd, "r");
    if (!f) return -1;
    char buf[256];
    int exit_code = -1;
    while (fgets(buf, sizeof(buf), f)) {
        int n;
        if (sscanf(buf, "__EXIT_%d", &n) == 1) exit_code = n;
    }
    pclose(f);
    return exit_code;
}

TEST(simple_return) {
    write_file("/tmp/int_simple.c", "int main() { return 42; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_simple.c", "/tmp/int_simple"), 0);
    ASSERT_EQ(run_prog("/tmp/int_simple"), 42);
    remove("/tmp/int_simple");
}

TEST(function_call_add) {
    write_file("/tmp/int_add.c",
        "int add(int a, int b) { return a + b; }\n"
        "int main() { return add(3, 4); }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_add.c", "/tmp/int_add"), 0);
    ASSERT_EQ(run_prog("/tmp/int_add"), 7);
    remove("/tmp/int_add");
}

TEST(local_var_init) {
    write_file("/tmp/int_var.c",
        "int main() { int x = 10; return x; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_var.c", "/tmp/int_var"), 0);
    ASSERT_EQ(run_prog("/tmp/int_var"), 10);
    remove("/tmp/int_var");
}

TEST(local_var_assign) {
    write_file("/tmp/int_asgn.c",
        "int main() { int x; x = 10; return x; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_asgn.c", "/tmp/int_asgn"), 0);
    ASSERT_EQ(run_prog("/tmp/int_asgn"), 10);
    remove("/tmp/int_asgn");
}

TEST(global_var) {
    write_file("/tmp/int_global.c",
        "int g = 42; int main() { return g; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_global.c", "/tmp/int_global"), 0);
    ASSERT_EQ(run_prog("/tmp/int_global"), 42);
    remove("/tmp/int_global");
}

TEST(arithmetic) {
    write_file("/tmp/int_arith.c",
        "int main() { int a = 2; int b = 3; return a + b * 4; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_arith.c", "/tmp/int_arith"), 0);
    ASSERT_EQ(run_prog("/tmp/int_arith"), 14);
    remove("/tmp/int_arith");
}

TEST(comparison_gt) {
    write_file("/tmp/int_cmp.c",
        "int main() { if (5 > 3) return 1; else return 0; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_cmp.c", "/tmp/int_cmp"), 0);
    ASSERT_EQ(run_prog("/tmp/int_cmp"), 1);
    remove("/tmp/int_cmp");
}

TEST(comparison_le) {
    write_file("/tmp/int_cmp2.c",
        "int main() { if (3 <= 5) return 1; else return 0; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_cmp2.c", "/tmp/int_cmp2"), 0);
    ASSERT_EQ(run_prog("/tmp/int_cmp2"), 1);
    remove("/tmp/int_cmp2");
}

TEST(if_else) {
    write_file("/tmp/int_if.c",
        "int main() { int x = 5; if (x > 0) return 1; else return 0; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_if.c", "/tmp/int_if"), 0);
    ASSERT_EQ(run_prog("/tmp/int_if"), 1);
    remove("/tmp/int_if");
}

TEST(while_loop) {
    write_file("/tmp/int_while.c",
        "int main() { int i = 0; while (i < 3) i = i + 1; return i; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_while.c", "/tmp/int_while"), 0);
    ASSERT_EQ(run_prog("/tmp/int_while"), 3);
    remove("/tmp/int_while");
}

TEST(for_loop) {
    write_file("/tmp/int_for.c",
        "int main() { int s = 0; for (int i = 0; i < 3; i = i + 1) s = s + i; return s; }\n");
    ASSERT_EQ(compile_and_link("/tmp/int_for.c", "/tmp/int_for"), 0);
    ASSERT_EQ(run_prog("/tmp/int_for"), 3);
    remove("/tmp/int_for");
}

TEST(semantic_error) {
    write_file("/tmp/int_err.c", "int main() { return x; }\n");
    int rc = compile_and_link("/tmp/int_err.c", "/tmp/int_err");
    ASSERT(rc != 0);
}

TEST(missing_semicolon) {
    write_file("/tmp/int_syn.c", "int main() { return 42 }\n");
    int rc = compile_and_link("/tmp/int_syn.c", "/tmp/int_syn");
    ASSERT(rc != 0);
}

int main(void) {
    printf("Running C integration tests...\n\n");

    RUN(simple_return);
    RUN(function_call_add);
    RUN(local_var_init);
    RUN(local_var_assign);
    RUN(global_var);
    RUN(arithmetic);
    RUN(comparison_gt);
    RUN(comparison_le);
    RUN(if_else);
    RUN(while_loop);
    RUN(for_loop);
    RUN(semantic_error);
    RUN(missing_semicolon);

    printf("\n========================================\n");
    printf("Results: %d passed, %d failed, %d total\n", tests_passed, tests_failed, tests_run);
    printf("========================================\n");

    return tests_failed > 0 ? 1 : 0;
}
