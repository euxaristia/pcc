#include <linux/types.h>

typedef unsigned long loff_t;
typedef unsigned int umode_t;

struct file {
    loff_t f_pos;
};

static inline loff_t generic_file_llseek(struct file *file, loff_t offset, int whence)
{
    return offset;
}

int kernel_main(void)
{
    struct file f;
    f.f_pos = 0;
    
    loff_t pos = generic_file_llseek(&f, 100L, 0);
    
    int x = 10;
    int *ptr = &x;
    (void)ptr;
    (void)f;
    (void)pos;
    return 0;
}
