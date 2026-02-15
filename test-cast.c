// More complex cast tests
int test(void) {
    // Simple cast
    int x = (int)42;
    
    // Pointer cast
    int *ptr = (int *)0x1000;
    
    // Cast with dereference
    int y = *(int *)ptr;
    
    // Cast in expression
    int z = (int)(char)(short)x;
    
    return x + y + z;
}
