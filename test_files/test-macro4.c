#define FOO(x) BAR(x)
#define BAR(x) BAZ(x)

int main(void) {
    if (FOO(1)) { }
    return 0;
}
