// Preprocessed kernel code - simplified for PCC

typedef unsigned long size_t;
typedef unsigned long ulong;
typedef unsigned int u32;
typedef unsigned long u64;

typedef _Bool bool;
#define true 1
#define false 0

#define BIT(nr) (1UL << (nr))
#define min(x, y) ((x) < (y) ? (x) : (y))
#define max(x, y) ((x) > (y) ? (x) : (y))
#define ALIGN(x, a) (((x) + (a) - 1) & ~((a) - 1))

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

struct my_data {
    int id;
    struct list_head list;
};

void add_item(int id) {
    struct my_data *data = (struct my_data *)0x1000;
    (void)data;
}

void test_bitops(void) {
    unsigned long flags = 0;
    unsigned long bit0 = BIT(0);
    unsigned long bit5 = BIT(5);
    unsigned long bit31 = BIT(31);
    
    flags = flags | bit0 | bit5 | bit31;
    
    if ((flags & bit5) != 0) {
        flags = flags & ~bit5;
    }
    
    (void)flags;
}

void test_minmax(void) {
    int a = 5;
    int b = 10;
    int minval = min(a, b);
    int maxval = max(a, b);
    
    (void)minval;
    (void)maxval;
}

int main(void) {
    add_item(1);
    add_item(2);
    test_bitops();
    test_minmax();
    return 0;
}
