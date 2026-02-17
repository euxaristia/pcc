#include <linux/types.h>

// Test aligned attribute
struct __attribute__((aligned(64))) aligned_struct {
    u64 timestamp;
    u32 flags;
    u16 id;
    u8 data[56];
};

// Test packed attribute
struct __attribute__((packed)) packed_struct {
    u8 a;
    u32 b;
    u8 c;
};

int main(void) {
    struct aligned_struct as;
    as.timestamp = 123456789;
    as.flags = 0xFF;
    as.id = 42;
    
    struct packed_struct ps;
    ps.a = 1;
    ps.b = 2;
    ps.c = 3;
    
    return (int)(as.timestamp + ps.b);
}
