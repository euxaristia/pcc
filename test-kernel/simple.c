typedef unsigned long ulong;
typedef unsigned int uint;
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef unsigned long long u64;

struct list_head {
    struct list_head *next;
    struct list_head *prev;
};

struct task_struct {
    int pid;
    unsigned long state;
    struct list_head tasks;
    char comm[16];
};

int main() {
    struct task_struct init_task = {
        .pid = 0,
        .state = 1,
    };
    return init_task.pid;
}
