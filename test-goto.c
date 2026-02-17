int test_goto(int n) {
    int result = 0;
    if (n < 0) goto done;
    result = n * 2;
done:
    return result;
}

int main(void) {
    return test_goto(5);
}
