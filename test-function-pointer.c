void (*func_ptr)(void);
void (*func_ptr2)(int, char);

void test_function_pointers() {
    void (*local_ptr)(void) = func_ptr;
    *(void(**)(void))(code-8) = mpenter;
}