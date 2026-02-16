#include <stddef.h>
#include <stdint.h>
#include <limits.h>

typedef unsigned long ulong;
typedef unsigned int uint;
typedef unsigned short ushort;
typedef unsigned char uchar;
typedef unsigned int u32;
typedef unsigned long u64;
typedef unsigned short u16;
typedef unsigned char u8;

#define ARRAY_SIZE(x) (sizeof(x) / sizeof((x)[0]))
#define ALIGN(x, a) (((x) + (a) - 1) & ~((a) - 1))
#define container_of(ptr, type, member) ((type *)((char *)(ptr) - offsetof(type, member)))

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

static inline int fls(int x) {
    int r = 32;
    if (!x)
        return 0;
    if (!(x & 0xFFFF0000U)) {
        x <<= 16;
        r -= 16;
    }
    if (!(x & 0xFF000000U)) {
        x <<= 8;
        r -= 8;
    }
    if (!(x & 0xF0000000U)) {
        x <<= 4;
        r -= 4;
    }
    if (!(x & 0xC0000000U)) {
        x <<= 2;
        r -= 2;
    }
    return r;
}

static inline u32 readl(volatile u32 *addr) {
    u32 val = *addr;
    return val;
}

static inline void writel(u32 val, volatile u32 *addr) {
    *addr = val;
}

static inline unsigned long read_cr0(void) {
    unsigned long cr0;
    __asm__ volatile("mov %%cr0, %0" : "=r" (cr0));
    return cr0;
}

static inline void write_cr0(unsigned long cr0) {
    __asm__ volatile("mov %0, %%cr0" : : "r" (cr0));
}

struct __attribute__((aligned(64))) aligned_struct {
    u64 timestamp;
    u32 flags;
    u16 id;
    u8 data[56];
};

struct bitfield_test {
    u32 a:4;
    u32 b:28;
};

int initcall_count = 0;

void *my_memcpy(void *dest, void *src, ulong n) {
    u8 *d = (u8 *)dest;
    u8 *s = (u8 *)src;
    while (n--) {
        *d++ = *s++;
    }
    return dest;
}

void *my_memset(void *s, int c, ulong n) {
    u8 *p = (u8 *)s;
    while (n--) {
        *p++ = (u8)c;
    }
    return s;
}

int kernel_main(void) {
    volatile u32 *regs = (u32 *)0x1000;
    
    writel(0x12345678, regs);
    u32 val = readl(regs);
    
    unsigned long cr0 = read_cr0();
    (void)cr0;
    
    struct aligned_struct as;
    as.timestamp = 123456789;
    as.flags = 0xFF;
    as.id = 42;
    
    struct bitfield_test bf;
    bf.a = 5;
    bf.b = 100;
    
    struct list_head *pos = 0;
    (void)pos;
    
    (void)val;
    
    return 0;
}
