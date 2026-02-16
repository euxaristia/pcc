typedef unsigned long ulong;
typedef unsigned int uint;
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef unsigned long long u64;

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

struct spinlock {
    unsigned long lock;
};

struct task_struct {
    int pid;
    unsigned long state;
    struct list_head tasks;
    struct spinlock lock;
    char comm[16];
};

enum {
    TASK_RUNNING = 0,
    TASK_INTERRUPTIBLE = 1,
    TASK_UNINTERRUPTIBLE = 2,
};

static inline void spin_lock(struct spinlock *lock)
{
    lock->lock = 1;
}

static inline void spin_unlock(struct spinlock *lock)
{
    lock->lock = 0;
}

static inline ulong readl(volatile ulong *addr)
{
    return *addr;
}

extern void printk(const char *fmt, ...);

void kernel_init(void) {
    struct task_struct init_task = {
        .pid = 0,
        .state = TASK_RUNNING,
    };
    
    struct spinlock test_lock = { .lock = 0 };
    spin_lock(&test_lock);
    
    ulong value = readl((volatile ulong*)0x1000);
    
    spin_unlock(&test_lock);
    
    printk("Kernel initialized, value=%lu\n", value);
}

int add(int a, int b) {
    return a + b;
}

int main() {
    kernel_init();
    return add(1, 2);
}
