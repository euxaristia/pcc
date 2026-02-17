#define NOTNOT(x) !!(x)

int main(void) {
    if (NOTNOT(1)) { }
    return 0;
}
