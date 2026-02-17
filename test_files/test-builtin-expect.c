// Test __builtin_expect
int test_builtin_expect(void) {
    int x = __builtin_expect(1, 0);
    int y = __builtin_expect(0, 1);
    if (__builtin_expect(x == 1, 1)) {
        return 42;
    }
    return 0;
}
