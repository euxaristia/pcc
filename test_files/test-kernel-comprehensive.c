// More comprehensive kernel-like test

// Test pointer arithmetic and dereferencing
int test_pointers() {
    int x = 42;
    int *ptr = &x;
    int y = *ptr;
    
    // Pointer arithmetic
    int arr[5];
    int *p = arr;
    p = p + 1;
    
    return y;
}

// Test struct usage
struct Point {
    int x;
    int y;
};

int test_structs() {
    struct Point p;
    p.x = 10;
    p.y = 20;
    return p.x + p.y;
}

// Test array access
int test_arrays() {
    int arr[5];
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = 3;
    return arr[0] + arr[1] + arr[2];
}

// Test basic kernel function
int kernel_main() {
    int a = test_pointers();
    int b = test_structs();
    int c = test_arrays();
    return a + b + c;
}

int main() {
    return kernel_main();
}
