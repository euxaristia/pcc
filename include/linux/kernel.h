/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _LINUX_KERNEL_H
#define _LINUX_KERNEL_H

#include <linux/sysinfo.h>
#include <linux/const.h>
#include <linux/stddef.h>

/* Kernel logging levels */
#define KERN_EMERG
#define KERN_ALERT
#define KERN_CRIT
#define KERN_ERR
#define KERN_WARNING
#define KERN_NOTICE
#define KERN_INFO
#define KERN_DEBUG

/* Printk - stub for now */
#define printk(fmt, ...) 0

/* ContainerOf - cast a member pointer to the containing structure */
#define container_of(ptr, type, member) \
    ((type *)((char *)(ptr) - __builtin_offsetof(type, member)))

/* Min/Max macros */
#define min(x, y) ((x) < (y) ? (x) : (y))
#define max(x, y) ((x) > (y) ? (x) : (y))

/* Barrier macros */
#define barrier() __asm__ __volatile__("" ::: "memory")

/* Compiler hints */
#define likely(x) __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

/* Array size */
#define ARRAY_SIZE(arr) (sizeof(arr) / sizeof((arr)[0]))

/* Misc helpers */
#define BUILD_BUG_ON(expr) ((void)sizeof(char[1 - 2 * !!(expr)]))
#define ACCESS_ONCE(x) (*(volatile typeof(x) *)&(x))

/* Error handling - stubs */
#define WARN_ON(condition) ((void)!!(condition))
#define BUG() do { } while (0)

/* Section macros */
#define __section(S) __attribute__((__section__(#S)))
#define __init __attribute__((__init__))
#define __exit __attribute__((__exit__))

#endif /* _LINUX_KERNEL_H */
