// Test type casting and additional types

int test_types() {
    // Test type casting
    int a = 10;
    char b = (char)a;
    
    // Test hex literals
    int hex_val = 0xFF;
    int oct_val = 077;
    
    // Test different integer types
    long l = 100L;
    short s = 50;
    unsigned int u = 200U;
    
    return hex_val + oct_val;
}

int main() {
    return test_types();
}
