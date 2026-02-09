void test_asm_constraints() {
    unsigned int value = 42;
    // Test with input and output constraints
    __asm__ volatile ("mov %0, %1" : "=r" (r) : "memory");
}