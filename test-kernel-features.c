#include <linux/types.h>
#include <stdarg.h>
#include <stdbool.h>

// Test bool type
bool test_bool(void) {
    bool b = true;
    bool c = false;
    return b && !c;
}

// Test complex pointers
void *test_ptr(void) {
    int x = 42;
    int *p = &x;
    void *vp = (void *)p;
    return vp;
}

// Test pointer arithmetic
int test_ptr_arith(void) {
    int arr[10];
    int *p = arr;
    p = p + 5;
    p = p - 3;
    return p[0];
}

// Test ternary operator
int test_ternary(int x) {
    return x > 0 ? x : -x;
}

// Test comma operator
int test_comma(void) {
    int a = 1, b = 2;
    int c = (a++, b++);
    return a + b + c;
}

// Test switch statement
int test_switch(int x) {
    switch (x) {
        case 0: return 1;
        case 1: return 2;
        case 2: return 3;
        default: return 0;
    }
}

// Test do-while
int test_do_while(int n) {
    int i = 0;
    do {
        i++;
    } while (i < n);
    return i;
}

// Test for with continue
int test_for_continue(int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        if (i % 2 == 0) continue;
        sum += i;
    }
    return sum;
}

// Test goto
int test_goto(int n) {
    int result = 0;
    if (n < 0) goto done;
    result = n * 2;
done:
    return result;
}

int main(void) {
    test_bool();
    test_ptr();
    test_ptr_arith();
    test_ternary(5);
    test_comma();
    test_switch(1);
    test_do_while(10);
    test_for_continue(10);
    test_goto(5);
    return 0;
}
