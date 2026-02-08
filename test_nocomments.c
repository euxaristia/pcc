enum Color {
    RED,
    GREEN = 5,
    BLUE
};

union Data {
    int i;
    float f;
    char str[20];
};

extern void external_func(void);

static inline int max(int a, int b) {
    return a > b ? a : b;
}

int main(void) {
    int x = 0xFF;
    int y = x << 2;
    int z = x >> 1;
    int w = x & 0xF0;
    int v = x | 0x0F;
    int u = x ^ 0xAA;
    int t = ~x;
    
    x += 10;
    y -= 5;
    z *= 2;
    w /= 4;
    v |= 0x55;
    u &= 0x0F;
    
    int result = (x > y) ? x : y;
    
    enum Color c = RED;
    
    int i = 0;
    do {
        i++;
    } while (i < 5);
    
    if (i == 5) {
        goto end_label;
    }
    
end_label:
    return 0;
}