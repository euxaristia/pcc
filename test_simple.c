// Simple test file for new C features (no includes)

// Enum declaration
enum Color {
    RED,
    GREEN = 5,
    BLUE
};

// Union declaration  
union Data {
    int i;
    float f;
    char str[20];
};

// Extern function declaration
extern void external_func(void);

// Inline function
static inline int max(int a, int b) {
    return a > b ? a : b;
}

int main(void) {
    // Bitwise operations
    int x = 0xFF;
    int y = x << 2;     // Left shift
    int z = x >> 1;     // Right shift
    int w = x & 0xF0;   // Bitwise AND
    int v = x | 0x0F;   // Bitwise OR
    int u = x ^ 0xAA;   // Bitwise XOR
    int t = ~x;         // Bitwise NOT
    
    // Compound assignment
    x += 10;
    y -= 5;
    z *= 2;
    w /= 4;
    v |= 0x55;
    u &= 0x0F;
    
    // Ternary operator
    int result = (x > y) ? x : y;
    
    // Enum usage
    enum Color c = RED;
    
    // Do-while loop
    int i = 0;
    do {
        i++;
    } while (i < 5);
    
    // Goto and labels
    if (i == 5) {
        goto end_label;
    }
    
end_label:
    return 0;
}