#define likely(x) __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

int main(void) {
    if (likely(1)) { }
    if (unlikely(0)) { }
    return 0;
}
