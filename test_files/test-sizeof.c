// Test file for sizeof operator

int test_sizeof() {
    int a;
    char b;
    
    // Sizeof expressions
    int size_int = sizeof(int);
    int size_char = sizeof(char);
    int size_a = sizeof(a);
    int size_b = sizeof(b);
    int size_ptr = sizeof(int*);
    
    return size_int + size_char;
}

int main() {
    return test_sizeof();
}
