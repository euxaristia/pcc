#include <linux/types.h>

// Test list_head
struct list_head {
    struct list_head *next, *prev;
};

#define LIST_HEAD_INIT(name) { &(name), &(name) }
#define LIST_HEAD(name) struct list_head name = LIST_HEAD_INIT(name)

int main(void) {
    LIST_HEAD(my_list);
    return 0;
}
