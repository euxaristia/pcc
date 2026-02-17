// Test complex pointer operations

void test_pointer_arithmetic() {
    char *base = (char *)0x1000;
    int *int_ptr = (int *)base;
    void **void_ptr_ptr = (void **)base;
    
    // Pointer arithmetic with same types
    int *array_ptr = int_ptr + 5;
    char *advanced = base + 3;
    
    // Function pointer
    void (*func_ptr)(void);
}
