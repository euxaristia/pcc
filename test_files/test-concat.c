// Test token concatenation ##
#define CONCAT(a, b) a##b
#define MAKE_FUNC(name) int func_##name(void) { return 42; }

MAKE_FUNC(test)
MAKE_FUNC(other)

int main(void) {
    int xy = 10;
    int result = CONCAT(x, y);
    return result;
}
