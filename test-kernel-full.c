// Simplified kernel-like test with builtins
typedef unsigned int u32;
typedef unsigned long u64;

int test(void)
{
    // Test __builtin_expect
    int likely = __builtin_expect(1, 1);
    int unlikely = __builtin_expect(0, 0);
    
    // Test branch prediction
    if (__builtin_expect(likely, 1)) {
        // This is likely
    }
    
    if (__builtin_expect(unlikely, 0)) {
        // This is unlikely
        return 1;
    }
    
    // Test compound literal
    int x = (int){42};
    
    return x + 1;
}
