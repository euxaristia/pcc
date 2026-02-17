// Test file for preprocessor and new features
#include <stddef.h>

#define MAX_SIZE 100
#define MIN(a, b) ((a) < (b) ? (a) : (b))

typedef unsigned int uint32_t;
typedef struct Point {
    int x;
    int y;
} Point;

int test_switch(int n) {
    switch (n) {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
        case 3:
            return n * 2;
        default:
            return -1;
    }
}

int test_loops() {
    int sum = 0;
    
    // Test break
    for (int i = 0; i < 100; i++) {
        if (i >= 10) {
            break;
        }
        sum += i;
    }
    
    // Test continue
    int count = 0;
    for (int i = 0; i < 20; i++) {
        if (i % 2 == 0) {
            continue;
        }
        count++;
    }
    
    return sum + count;
}

int test_typedef() {
    uint32_t a = 42;
    Point p;
    p.x = 10;
    p.y = 20;
    return a + p.x + p.y;
}

int main() {
    int result = 0;
    result += test_switch(2);
    result += test_loops();
    result += test_typedef();
    result += MIN(5, 3);
    return result;
}
