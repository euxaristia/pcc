#include <linux/types.h>

// Test complex macros
#define __iomem
#define __force
#define __attribute_const__ __attribute__((const))

// Test typeof operator
static inline void *memcpy(void *dest, const void *src, unsigned long n)
{
    unsigned char *d = (unsigned char *)dest;
    const unsigned char *s = (const unsigned char *)src;
    while (n--)
        *d++ = *s++;
    return dest;
}

// Test complex types
struct file {
    void *private_data;
};

struct inode {
    unsigned long i_ino;
    unsigned int i_nlink;
};

// Test container_of macro
#define container_of(ptr, type, member) ({ \
    const typeof(((type *)0)->member) *__mptr = (ptr); \
    (type *)((char *)__mptr - offsetof(type, member)); })

// Test list_head
struct list_head {
    struct list_head *next, *prev;
};

#define LIST_HEAD_INIT(name) { &(name), &(name) }
#define LIST_HEAD(name) struct list_head name = LIST_HEAD_INIT(name)

static inline void list_add(struct list_head *new, struct list_head *head)
{
    head->next->prev = new;
    new->next = head->next;
    new->prev = head;
    head->next = new;
}

// Test bit operations
#define set_bit(nr, addr) ((void)0)
#define clear_bit(nr, addr) ((void)0)
#define change_bit(nr, addr) ((void)0)
#define test_bit(nr, addr) (0)

// Test BUG_ON
#define BUG_ON(cond) do { if (cond) { } } while (0)

// Test might_sleep
#define might_sleep() do { } while (0)

// Test build_bug_on
#define BUILD_BUG_ON(condition) ((void)sizeof(char[1 - 2*!!(condition)]))

int test_list(void) {
    LIST_HEAD(my_list);
    struct list_head item;
    list_add(&item, &my_list);
    return 0;
}

int test_inode(void) {
    struct inode ino;
    ino.i_ino = 42;
    ino.i_nlink = 1;
    return (int)ino.i_ino;
}

int main(void) {
    test_list();
    test_inode();
    return 0;
}
