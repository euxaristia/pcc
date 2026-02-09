// Test all the xv6 features we've implemented

// 1. Attributes before variable declarations
__attribute__((__aligned__(16)))
int aligned_var = 42;

// 2. Function attributes  
void test_function(void) __attribute__((noreturn));

// 3. Designated initializers
int array[5] = {
  [0] = 10,
  [1] = 20,
  [2] = 30
};

// 4. Function pointer declarations
void (*func_ptr)(void);
int (*func_ptr2)(int, char);

// 5. Complex function pointer casts
void assign_function_ptr() {
    void (*local_ptr)(void) = func_ptr;
    *(void(**)(void))(0x1000) = test_function;
}

// 6. Extern declarations with kernel types
extern uchar binary_data[];
extern pde_t *page_dir;

// 7. Variadic function declaration
int printf(const char *format, ...);

// 8. Static inline function
static inline int max(int a, int b) {
    return a > b ? a : b;
}

int main() {
    assign_function_ptr();
    return aligned_var + array[0];
}