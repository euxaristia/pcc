void put_char(char c) {
    // Simple function to write to serial port
    __asm__ volatile ("outb %0, $0x80" : : "r" (c) );
}

void main(void) {
    put_char('H');
    put_char('e');
    put_char('l');
    put_char('l');
    put_char('o');
    put_char('\n');
}