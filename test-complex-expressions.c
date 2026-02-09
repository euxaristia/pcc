// Test complex pointer operations and expressions used in xv6
#include "types.h"

// 1. Complex pointer arithmetic that xv6 uses
void test_pointer_arithmetic() {
    char *base = (char *)0x1000;
    int *int_ptr = (int *)base;
    void **void_ptr_ptr = (void **)base;
    
    // These are common patterns in xv6 kernel code:
    int offset = int_ptr - base;        // Pointer subtraction
    char *advanced = base + offset * 4; // Pointer arithmetic with scaling
    void *final_ptr = (void *)((uintptr_t)advanced + 1); // Pointer casting
    
    // Dereferencing complex expressions
    int value = *int_ptr;                // Simple dereference
    int nested_value = **void_ptr_ptr;     // Double dereference
    
    // Function pointer through complex expression
    int (*func_ptr)(void) = (void (*)(void))0x2000; // Cast to function pointer
    if (func_ptr) {
        func_ptr();                      // Call through function pointer
    }
}

// 2. Complex cast expressions
void test_complex_casts() {
    void *generic_ptr;
    int value = 42;
    
    // Multiple nested casts like xv6 uses
    generic_ptr = (void *)((char *)generic_ptr + sizeof(int)); // Cast with arithmetic
    generic_ptr = (void *)(((uintptr_t)generic_ptr) & ~3); // Bit masking
    generic_ptr = (void *)((uintptr_t)generic_ptr | 0x1000); // Bit operations
    
    // Array access through casted pointers
    int array_value = *((int *)generic_ptr + 1); // Array access with cast
}

// 3. Bitfield operations (critical for kernel code)
void test_bitfields() {
    struct {
        unsigned int flag1 : 1;
        unsigned int flag2 : 2;
        unsigned int flag3 : 3;
        unsigned int reserved : 28;
    } flags;
    
    // Complex bit operations used in xv6
    flags.flag1 = 1;
    flags.flag2 = flags.flag2 | 1;        // Read-modify-write
    flags.flag3 = flags.flag1 & ~flags.flag2; // Bit clear
    flags.reserved = (flags.flag1 << 3) | (flags.flag2 << 1); // Bit positioning
    
    // Test bit field access
    unsigned int combined = flags.flag1 | (flags.flag2 << 1) | (flags.flag3 << 2);
    
    // Mask and extract operations
    unsigned int extracted = (combined >> 1) & 0x7;  // Extract bits 1-3
}

// 4. Complex conditional expressions
void test_complex_conditionals() {
    int x = 10, y = 20, z = 30;
    int result;
    
    // Nested ternary operators (common in kernel code)
    result = x > y ? (x > z ? x : z) : z;
    
    // Complex boolean expressions with bitwise operations
    int flags = 0x05 | 0x0A;
    if ((flags & 0x0F) && !(flags & 0xF0)) {
        result = 100;
    } else if ((flags & 0xF0) && (flags & 0x0F)) {
        result = 200;
    } else {
        result = 300;
    }
    
    // Short-circuit evaluation patterns
    int *ptr = 0;
    if (ptr && *ptr > 0) {
        result = 400;
    }
}

// 5. Address-of operations with complex expressions
void test_address_operations() {
    int array[4] = {10, 20, 30, 40};
    void *ptr;
    int **double_ptr;
    
    // Taking address of array elements
    ptr = &array[2];                    // Simple address-of
    double_ptr = &ptr;                  // Address of pointer
    
    // Complex address expressions
    int *addr_of_func = (int (*)())&test_pointer_arithmetic; // Address of function
    void (*func_ptr_array[4]) = {test_pointer_arithmetic, test_complex_casts, test_bitfields, test_complex_conditionals};
}