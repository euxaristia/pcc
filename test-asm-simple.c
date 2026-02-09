void test_asm() {
    // Test basic inline assembly like xv6 uses
    __asm__ volatile ("outb %0, $0x80" : : "r" (c) );
}