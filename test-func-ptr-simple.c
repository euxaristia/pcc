// Test function pointer declarations like in xv6
extern uchar _binary_entryother_start[], _binary_entryother_size[];

void mpenter(void);

static void startothers(void) {
    uchar *code;
    struct cpu *c;
    char *stack;
    
    // This is the line that fails:
    *(void(**)(void))(code-8) = mpenter;
}