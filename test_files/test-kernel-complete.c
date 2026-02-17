#include <linux/types.h>
#include <stdarg.h>

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

static inline void INIT_LIST_HEAD(struct list_head *list)
{
    list->next = list;
    list->prev = list;
}

static inline void list_add(struct list_head *new, struct list_head *head)
{
    head->next->prev = new;
    new->next = head->next;
    new->prev = head;
    head->next = new;
}

static inline void list_add_tail(struct list_head *new, struct list_head *head)
{
    head->prev->next = new;
    new->next = head;
    new->prev = head->prev;
    head->prev = new;
}

static inline void list_del(struct list_head *entry)
{
    entry->prev->next = entry->next;
    entry->next->prev = entry->prev;
}

static inline int list_empty(const struct list_head *head)
{
    return head->next == head;
}

#define list_for_each(pos, head) \
    for (pos = (head)->next; pos != (head); pos = pos->next)

#define list_for_each_safe(pos, n, head) \
    for (pos = (head)->next, n = pos->next; pos != (head); \
        pos = n, n = pos->next)

#define container_of(ptr, type, member) \
    ((type *)((char *)(ptr) - offsetof(type, member)))

#define list_entry(ptr, type, member) \
    container_of(ptr, type, member)

#define list_first_entry(ptr, type, member) \
    list_entry((ptr)->next, type, member)

typedef struct {
    int a;
    int b;
} test_data_t;

static inline int fls(int x)
{
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

static inline u32 readl(volatile u32 *addr)
{
    return *addr;
}

static inline void writel(u32 val, volatile u32 *addr)
{
    *addr = val;
}

static inline unsigned long long rdtsc(void)
{
    unsigned long long val;
    __asm__ volatile("rdtsc" : "=A" (val));
    return val;
}

static inline void cpu_relax(void)
{
    __asm__ volatile("rep; nop" : : : "memory");
}

static inline void barrier(void)
{
    __asm__ volatile("" : : : "memory");
}

int test_snprintf(char *buf, int size, const char *fmt, ...)
{
    va_list args;
    int i;
    va_start(args, fmt);
    i = 0;
    (void)fmt;
    (void)args;
    va_end(args);
    return i;
}

void *memcpy(void *dest, const void *src, ulong n)
{
    u8 *d = (u8 *)dest;
    const u8 *s = (const u8 *)src;
    while (n--) {
        *d++ = *s++;
    }
    return dest;
}

void *memset(void *s, int c, ulong n)
{
    u8 *p = (u8 *)s;
    while (n--) {
        *p++ = (u8)c;
    }
    return s;
}

int memcmp(const void *s1, const void *s2, ulong n)
{
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

void *memmove(void *dest, const void *src, ulong n)
{
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

int strcmp(const char *s1, const char *s2)
{
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const u8 *)s1 - *(const u8 *)s2;
}

char *strcpy(char *dest, const char *src)
{
    char *d = dest;
    while ((*d++ = *src++) != '\0');
    return dest;
}

ulong strlen(const char *s)
{
    ulong len = 0;
    while (*s++) len++;
    return len;
}

static struct list_head kernel_list = { &kernel_list, &kernel_list };

int kernel_init(void)
{
    struct list_head *pos;
    test_data_t *data;
    
    INIT_LIST_HEAD(&kernel_list);
    
    data = (test_data_t *)0x1000;
    data->a = 42;
    data->b = 100;
    
    if (list_empty(&kernel_list)) {
        return 0;
    }
    
    for (pos = (&kernel_list)->next; pos != (&kernel_list); pos = pos->next) {
        (void)pos;
    }
    
    return 1;
}

int kernel_main(void)
{
    volatile u32 *regs = (u32 *)0x1000;
    
    writel(0x12345678, regs);
    u32 val = readl(regs);
    
    unsigned long long tsc = rdtsc();
    cpu_relax();
    barrier();
    
    int result = kernel_init();
    
    (void)val;
    (void)tsc;
    (void)result;
    
    return 0;
}
