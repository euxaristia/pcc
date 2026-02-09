// Demonstration of pcc's xv6 compatibility
// This file showcases all the major features now supported

// 1. Attributes before declarations
__attribute__((__aligned__(16)))
int aligned_global = 100;

// 2. Function attributes  
__attribute__((noreturn))
void kernel_panic(void) {
    while(1); // Infinite loop - noreturn
}

// 3. Designated initializers (like xv6 entrypgdir)
struct page_table {
    int entries[256];
} page_dir __attribute__((__aligned__(4096))) = {
    [0] = 0x1000,     // Page directory entry
    [0xFF] = 0x2000,  // Last entry with mapping
};

// 4. Function pointer declarations
void (*signal_handler)(int signum);
int (*compute_func)(int a, int b, int c);

// 5. Complex function pointer casts
void setup_function_pointers() {
    void (*local_ptr)(void) = signal_handler;
    *(void(**)(void))(0x1000) = compute_func;
}

// 6. Extern declarations with kernel types
extern unsigned char kernel_data[];
extern pde_t *current_page_dir;

// 7. Variadic function declarations  
void kernel_printf(const char *format, ...);

// 8. Static inline functions
static inline int max(int a, int b) {
    return a > b ? a : b;
}

// 9. Inline assembly (xv6 style)
void write_to_port(unsigned char value) {
    __asm__ volatile ("outb %0, $0x80" : : "r" (value));
}

// 10. Test that everything works together
int main(void) {
    // Test all features
    write_to_port(aligned_global);
    setup_function_pointers();
    
    // Test designated initializer
    int first_entry = page_dir.entries[0];
    
    // Test function pointer call
    if (signal_handler) {
        signal_handler(42);
    }
    
    // Test static inline
    int result = max(first_entry, 200);
    
    // Test variadic function
    kernel_printf("Result: %d\n", result);
    
    return result;
}