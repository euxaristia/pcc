// pcc xv6 compatibility demonstration - core features working

// 1. Attributes
__attribute__((__aligned__(16)))
int aligned_var = 42;

// 2. Function attributes
__attribute__((noreturn))
void never_returns(void) {
    while(1);
}

// 3. Function pointers
void (*func_ptr)(void);
int (*func_with_params)(int a, int b);

// 4. Function pointer casts
void cast_test() {
    void (*local_ptr)(void) = func_ptr;
    *(void(**)(void))(0x1000) = func_with_params;
}

// 5. Designated initializers
int array[4] = {
    [0] = 10,
    [1] = 20,
    [2] = 30,
    [3] = 40
};

// 6. Kernel typedefs
extern unsigned char kernel_data[];
extern pde_t *page_dir;

// 7. Variadic functions
void debug_printf(const char *format, ...);

// 8. Static inline functions
static inline int add(int a, int b) {
    return a + b;
}

// 9. Inline assembly
void outb_port(unsigned char value) {
    __asm__ volatile ("outb %0, $0x80" : : "r" (value));
}

int main(void) {
    cast_test();
    
    int sum = add(array[0], array[1]);
    sum = add(sum, array[2]);
    
    debug_printf("Sum: %d\n", sum);
    
    return array[3];
}