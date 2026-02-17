#include <linux/types.h>
#include <stdarg.h>

// Test variadic functions (like printk)
int printk(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    // In real kernel, this would format and print
    va_end(args);
    return 0;
}

int main(void) {
    printk("Hello %s\n", "world");
    printk("Number: %d\n", 42);
    return 0;
}
