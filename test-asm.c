#include <linux/types.h>

// Test inline assembly
static inline unsigned long read_cr0(void) {
    unsigned long cr0;
    __asm__ volatile("mov %%cr0, %0" : "=r" (cr0));
    return cr0;
}

static inline void write_cr0(unsigned long cr0) {
    __asm__ volatile("mov %0, %%cr0" : : "r" (cr0));
}

int main(void) {
    unsigned long cr0 = read_cr0();
    write_cr0(cr0);
    return (int)cr0;
}
