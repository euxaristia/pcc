/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _LINUX_COMPILER_H
#define _LINUX_COMPILER_H

/* Compiler attributes */
#define __attribute_const__ __attribute__((__const__))
#define __attribute_malloc__ __attribute__((__malloc__))
#define __attribute_pure__ __attribute__((__pure__))
#define __attribute_used__ __attribute__((__used__))
#define __attribute_unused__ __attribute__((__unused__))
#define __attribute_deprecated__ __attribute__((__deprecated__))
#define __attribute_noinline__ __attribute__((__noinline__))
#define __attribute_inline__ __attribute__((__inline__))
#define __attribute_always_inline__ __attribute__((__always_inline__))
#define __attribute_noreturn__ __attribute__((__noreturn__))
#define __attribute_format_arg__(x) __attribute__((__format_arg__(x)))
#define __attribute_format_printf__(x,y) __attribute__((__format_printf__(x,y)))
#define __attribute_aligned__(x) __attribute__((__aligned__(x)))
#define __attribute_packed__ __attribute__((__packed__))
#define __attribute_weak__ __attribute__((__weak__))

/* Branch prediction hints */
#define __builtin_expect(x, expected_value) __builtin_expect((x), (expected_value))

/* Volatile access */
#define ACCESS_ONCE(x) (*(volatile typeof(x) *)&(x))

/* Cache control */
#define prefetch(x) __builtin_prefetch(x)

#endif /* _LINUX_COMPILER_H */
