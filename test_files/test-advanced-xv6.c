// Test advanced xv6 features

// 1. Complex struct definitions with nested structures
struct complex_struct {
    int field1;
    char field2[32];
    struct {
        int nested_field;
        void *nested_ptr;
    } inner_struct;
    void (*callback_func)(int, void *);
};

// 2. Bitfield operations (common in kernel code)
struct bitfield_example {
    unsigned int flag1 : 1;
    unsigned int flag2 : 2;
    unsigned int flag3 : 3;
    unsigned int combined : 8;
};

extern int kernel_feature_flag;

int advanced_kernel_code() {
    struct bitfield_example flags;
    struct complex_struct local_struct;
    
    // Test bitfield operations
    flags.flag1 = 1;
    flags.flag2 = 2;
    flags.combined = flags.flag1 | (flags.flag2 << 1);
    
    // Test nested struct access
    local_struct.field1 = 42;
    local_struct.inner_struct.nested_field = 100;
    
    // Test pointer arithmetic
    int *array_ptr = (int *)0x1000;
    array_ptr = array_ptr + 64;
    
    return flags.combined + local_struct.field1;
}
