#include <linux/types.h>
#include <stdarg.h>

// Kernel-style linked list
struct list_head {
    struct list_head *next, *prev;
};

#define LIST_HEAD_INIT(name) { &(name), &(name) }
#define LIST_HEAD(name) struct list_head name = LIST_HEAD_INIT(name)

static inline void list_add(struct list_head *new, struct list_head *head) {
    head->next->prev = new;
    new->next = head->next;
    new->prev = head;
    head->next = new;
}

static inline void list_del(struct list_head *entry) {
    entry->prev->next = entry->next;
    entry->next->prev = entry->prev;
}

#define container_of(ptr, type, member) ((type *)((char *)(ptr) - offsetof(type, member)))

// Test inline assembly
static inline unsigned long read_cr0(void) {
    unsigned long cr0;
    __asm__ volatile("mov %%cr0, %0" : "=r" (cr0));
    return cr0;
}

// Test bitfields
struct flags {
    u32 a:4;
    u32 b:28;
};

// Test aligned struct
struct __attribute__((aligned(64))) aligned_data {
    u64 timestamp;
    u32 flags;
    u8 data[56];
};

// Test variadic
int printk(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    va_end(args);
    return 0;
}

// Test complex expressions
#define likely(x) __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

int main(void) {
    // Test list
    LIST_HEAD(my_list);
    struct list_head item;
    list_add(&item, &my_list);
    list_del(&item);
    
    // Test container_of
    struct aligned_data data;
    struct list_head *node = 0;
    // container_of(node, struct aligned_data, list) - simplified
    
    // Test inline asm
    unsigned long cr0 = read_cr0();
    (void)cr0;
    
    // Test bitfields
    struct flags f;
    f.a = 5;
    f.b = 100;
    
    // Test aligned struct
    struct aligned_data ad;
    ad.timestamp = 123456789;
    ad.flags = 0xFF;
    
    // Test likely/unlikely
    if (likely(1)) {
        printk("likely\n");
    }
    if (unlikely(0)) {
        printk("unlikely\n");
    }
    
    return (int)ad.timestamp;
}
