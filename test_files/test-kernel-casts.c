// Test kernel-like code with casts
typedef unsigned int u32;
typedef unsigned long u64;

static inline u32 readl(volatile u32 *addr)
{
    u32 val = *addr;
    return val;
}

static inline void writel(u32 val, volatile u32 *addr)
{
    *addr = val;
}

int test(void)
{
    volatile u32 *regs = (volatile u32 *)0x1000;
    writel(0x12345678, regs);
    u32 val = readl(regs);
    
    // Cast test
    int *p = (int *)regs;
    int x = *(int *)p;
    
    return (int)val + x;
}
