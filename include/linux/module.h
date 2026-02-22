/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _LINUX_MODULE_H
#define _LINUX_MODULE_H

/* Flags for sys_finit_module: */
#define MODULE_INIT_IGNORE_MODVERSIONS	1
#define MODULE_INIT_IGNORE_VERMAGIC	2
#define MODULE_INIT_COMPRESSED_FILE	4

/* Module information macros */
#define MODULE_LICENSE(x)
#define MODULE_AUTHOR(x)
#define MODULE_DESCRIPTION(x)
#define MODULE_VERSION(x)
#define MODULE_PARM(x, y)
#define MODULE_DEVICE_TABLE(x, y)

#endif /* _LINUX_MODULE_H */
