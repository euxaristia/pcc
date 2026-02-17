// Simple test to verify ARM64 ELF generation
int test_function(int x, int y) {
    return x + y;
}

int main() {
    int result = test_function(5, 10);
    return result;
}