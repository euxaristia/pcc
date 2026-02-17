#define unlikely(x) __builtin_expect(!!(x), 0)

int main(void) {
    if (unlikely(0)) { }
    return 0;
}
