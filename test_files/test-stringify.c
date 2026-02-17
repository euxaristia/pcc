// Test stringification #
#define STRINGIFY(x) #x
#define TO_STRING(x) STRINGIFY(x)

int main(void) {
    const char *s = TO_STRING(hello world);
    return 0;
}
