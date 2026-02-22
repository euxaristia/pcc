/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _LINUX_INIT_H
#define _LINUX_INIT_H

#define __init __attribute__((__init__))
#define __exit __attribute__((__exit__))
#define __initdata
#define __exitdata
#define __initconst
#define __exitconst
#define __initcall(x) static initcall_t __initcall_##x __init_section = x
#define __exitcall(x) static exitcall_t __exitcall_##x __exit_section = x

typedef int (*initcall_t)(void);
typedef void (*exitcall_t)(void);

#define __init_section __attribute__((section(".init.text")))
#define __exit_section __attribute__((section(".exit.text")))

#define module_init(x) __initcall(x)
#define module_exit(x) __exitcall(x)

#endif /* _LINUX_INIT_H */
