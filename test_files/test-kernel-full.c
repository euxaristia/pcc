// Preprocessed kernel code - common patterns

typedef unsigned long size_t;
typedef unsigned long ulong;
typedef unsigned int u32;
typedef unsigned long u64;

// Common kernel types
typedef _Bool bool;
#define true 1
#define false 0

// Page size
#define PAGE_SHIFT 12
#define PAGE_SIZE (1UL << PAGE_SHIFT)
#define PAGE_MASK (~(PAGE_SIZE - 1))

// Bit operations
#define BIT(nr) (1UL << (nr))

// Min/max
#define min(x, y) ((x) < (y) ? (x) : (y))
#define max(x, y) ((x) > (y) ? (x) : (y))

// Alignment
#define ALIGN(x, a) (((x) + (a) - 1) & ~((a) - 1))

// Struct list_head - kernel linked list
struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

void __list_add(struct list_head *new_node, struct list_head *prev, struct list_head *next) {
    next->prev = new_node;
    new_node->next = next;
    new_node->prev = prev;
    prev->next = new_node;
}

void list_add(struct list_head *new_node, struct list_head *head) {
    __list_add(new_node, head, head->next);
}

void list_add_tail(struct list_head *new_node, struct list_head *head) {
    __list_add(new_node, head->prev, head);
}

void __list_del(struct list_head *prev, struct list_head *next) {
    next->prev = prev;
    prev->next = next;
}

void list_del(struct list_head *entry) {
    __list_del(entry->prev, entry->next);
    entry->next = 0;
    entry->prev = 0;
}

// Test the list functions
struct my_data {
    int id;
    struct list_head list;
};

struct list_head my_list;

void add_item(int id) {
    struct my_data *data = (struct my_data *)0x1000;
    data->id = id;
    list_add_tail(&data->list, &my_list);
}

void remove_item(int id) {
    struct list_head *pos;
    for (pos = my_list.next; pos != &my_list; pos = pos->next) {
        struct my_data *data = (struct my_data *)((char *)pos - 16);
        if (data->id == id) {
            list_del(pos);
            return;
        }
    }
}

void test_bitops(void) {
    unsigned long flags = 0;
    
    flags = flags | BIT(0);
    flags = flags | BIT(5);
    flags = flags | BIT(31);
    
    if ((flags & BIT(5)) != 0) {
        flags = flags & ~BIT(5);
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
    my_list.next = &my_list;
    my_list.prev = &my_list;
    
    add_item(1);
    add_item(2);
    remove_item(1);
    test_bitops();
    test_minmax();
    return 0;
}
