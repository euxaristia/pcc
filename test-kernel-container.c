// Test container_of-like macro usage

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

struct my_struct {
    int id;
    char name[32];
    struct list_head list;
};

struct my_struct *container_of(struct list_head *ptr) {
    return (struct my_struct *)0;
}

void test_list(void) {
    struct my_struct s;
    struct list_head *entry = (struct list_head *)((char *)&s + 0);
    
    struct my_struct *container = container_of(entry);
    (void)container;
}

static inline unsigned long bit(int nr) {
    return 1UL << nr;
}

void test_bits(void) {
    unsigned long flags = bit(0) | bit(5) | bit(31);
    (void)flags;
}

static inline int test_offsetof_func(void) {
    int offset_b = 4;
    (void)offset_b;
    return 0;
}

int main(void) {
    test_list();
    test_bits();
    return test_offsetof_func();
}
