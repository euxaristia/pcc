#include <linux/types.h>

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
    loff_t pos = generic_file_llseek(&f, 100L, 0);
    (void)pos;
    return 0;
}
