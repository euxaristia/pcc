// Preprocessed minimal kernel code
typedef unsigned int u32;
typedef unsigned long u64;

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

#define LIST_HEAD(name) struct list_head name = { &name, &name }

static inline u32 readl(volatile u32 *addr)
{
    u32 val = *addr;
    return val;
}

static inline void writel(u32 val, volatile u32 *addr)
{
    *addr = val;
}

struct foo {
    u32 flags;
    u64 data;
};

int test(void)
{
    volatile u32 *regs = (u32 *)0x1000;
    writel(0x12345678, regs);
    u32 val = readl(regs);
    
    struct foo f;
    f.flags = 1;
    f.data = 42;
    
    return (int)val;
}
