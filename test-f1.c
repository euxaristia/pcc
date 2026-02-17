#include <linux/types.h>

bool test_bool(void) {
    bool b = true;
    bool c = false;
    return b && !c;
}

int main(void) {
    test_bool();
    return 0;
}
