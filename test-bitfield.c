#include <linux/types.h>

// Test bitfields
struct bitfield_test {
    u32 a:4;
    u32 b:28;
};

int main(void) {
    struct bitfield_test bf;
    bf.a = 5;
    bf.b = 100;
    return bf.a + bf.b;
}
