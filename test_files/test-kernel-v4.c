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

typedef uint32_t __u32;
typedef uint64_t __u64;
typedef uint8_t __u8;
typedef uint16_t __u16;
typedef int32_t __s32;
typedef int64_t __s64;

#define ARRAY_SIZE(x) (sizeof(x) / sizeof((x)[0]))
#define ALIGN(x, a) (((x) + (a) - 1) & ~((a) - 1))
#define container_of(ptr, type, member) ((type *)((char *)(ptr) - offsetof(type, member)))
#define __aligned(x) __attribute__((aligned(x)))
#define __packed __attribute__((packed))
#define __attribute__(x)

#ifndef NULL
#define NULL ((void*)0)
#endif

#define EXPORT_SYMBOL(x)
#define MODULE_LICENSE(x)
#define MODULE_AUTHOR(x)
#define MODULE_DESCRIPTION(x)

#define likely(x) __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

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

static inline unsigned long long rdtsc(void) {
    unsigned long long val;
    __asm__ volatile("rdtsc" : "=A" (val));
    return val;
}

static inline void cpu_relax(void) {
    __asm__ volatile("rep; nop" : : : "memory");
}

static inline void barrier(void) {
    __asm__ volatile("" : : : "memory");
}

int initcall_count = 0;

void *memcpy(void *dest, const void *src, ulong n) {
    u8 *d = (u8 *)dest;
    const u8 *s = (const u8 *)src;
    while (n--) {
        *d++ = *s++;
    }
    return dest;
}

void *memset(void *s, int c, ulong n) {
    u8 *p = (u8 *)s;
    while (n--) {
        *p++ = (u8)c;
    }
    return s;
}

int memcmp(const void *s1, const void *s2, ulong n) {
    const u8 *p1 = s1;
    const u8 *p2 = s2;
    while (n--) {
        if (*p1 != *p2) {
            return *p1 - *p2;
        }
        p1++;
        p2++;
    }
    return 0;
}

void *memmove(void *dest, const void *src, ulong n) {
    if (dest < src) {
        return memcpy(dest, src, n);
    }
    u8 *d = (u8 *)dest + n;
    const u8 *s = (const u8 *)src + n;
    while (n--) {
        *--d = *--s;
    }
    return dest;
}

int strcmp(const char *s1, const char *s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const u8 *)s1 - *(const u8 *)s2;
}

char *strcpy(char *dest, const char *src) {
    char *d = dest;
    while ((*d++ = *src++) != '\0');
    return dest;
}

ulong strlen(const char *s) {
    ulong len = 0;
    while (*s++) len++;
    return len;
}

int kernel_main(void) {
    volatile u32 *regs = (u32 *)0x1000;
    
    writel(0x12345678, regs);
    u32 val = readl(regs);
    
    unsigned long cr0 = read_cr0();
    (void)cr0;
    
    unsigned long long tsc = rdtsc();
    (void)tsc;
    
    cpu_relax();
    barrier();
    
    (void)val;
    
    return 0;
}
