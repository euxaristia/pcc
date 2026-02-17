struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

int main(void) {
    struct list_head name = { &name, &name };
    return 0;
}
