// Test advanced xv6 features that still need work
#include "types.h"

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

// 2. Complex pointer arithmetic used in xv6
void complex_pointer_ops() {
    struct complex_struct *ptr;
    int *array_ptr;
    void *void_ptr;
    
    // These are common patterns in xv6
    ptr->field1 = 42;
    ptr->inner_struct.nested_field = 100;
    ptr->inner_struct.nested_ptr = &ptr->field1;
    
    // Pointer arithmetic that xv6 uses extensively
    array_ptr = (int *)0x1000 + 64;
    void_ptr = array_ptr + 16;
    
    // Function calls through pointers
    if (ptr->callback_func) {
        ptr->callback_func(42, void_ptr);
    }
}

// 3. Bitfield operations (common in kernel code)
struct bitfield_example {
    unsigned int flag1 : 1;
    unsigned int flag2 : 2;
    unsigned int flag3 : 3;
    unsigned int combined : 8;
};

// 4. More advanced preprocessor patterns
#define KERNEL_FEATURE(x) \
    ((x) && defined(CONFIG_##x))

// 5. Complex expressions with macros
#define MAX(x, y) ((x) > (y) ? (x) : (y))
#define offsetof(type, member) ((size_t)&(((type *)0)->member))

extern int kernel_feature_flag;

void advanced_kernel_code() {
    struct bitfield_example flags;
    struct complex_struct local_struct;
    
    // Test bitfield operations
    flags.flag1 = 1;
    flags.flag2 = 2;
    flags.combined = flags.flag1 | (flags.flag2 << 1);
    
    // Test offsetof macro usage
    int offset = offsetof(struct complex_struct, inner_struct);
    
    // Test complex conditional compilation
    if (KERNEL_FEATURE(ADVANCED_SCHEDULING)) {
        local_struct.callback_func = complex_pointer_ops;
    }
    
    return flags.combined + offset;
}