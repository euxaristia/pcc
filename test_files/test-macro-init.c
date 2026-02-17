#define FOO(x) { &(x), &(x) }

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

int main(void) {
    struct list_head name = FOO(name);
    return 0;
}
