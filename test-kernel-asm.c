// More advanced kernel-like code
typedef unsigned int u32;
typedef unsigned long u64;

static inline u64 readq(volatile u64 *addr)
{
    u64 val;
    __asm__ volatile("movq %1, %0" : "=r" (val) : "m" (*addr));
    return val;
}

static inline void writeq(u64 val, volatile u64 *addr)
{
    __asm__ volatile("movq %0, %1" : "=m" (*addr) : "r" (val));
}

static inline unsigned long read_cr0(void)
{
    unsigned long cr0;
    __asm__ volatile("mov %%cr0, %0" : "=r" (cr0));
    return cr0;
}

static inline void write_cr0(unsigned long cr0)
{
    __asm__ volatile("mov %0, %%cr0" : : "r" (cr0));
}

int test(void)
{
    volatile u64 *regs = (u64 *)0x1000;
    writeq(0x123456789ABCDEF0, regs);
    u64 val = readq(regs);
    
    unsigned long cr0 = read_cr0();
    (void)cr0;
    
    write_cr0(cr0);
    
    return (int)val;
}
