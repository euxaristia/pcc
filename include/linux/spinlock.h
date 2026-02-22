/* SPDX-License-Identifier: GPL-2.0 WITH Linux-syscall-note */
#ifndef _LINUX_SPINLOCK_H
#define _LINUX_SPINLOCK_H

#define spinlock_t int

#define spin_lock_init(lock) do { *(lock) = 0; } while (0)
#define spin_lock(lock) do { } while (0)
#define spin_unlock(lock) do { } while (0)
#define DEFINE_SPINLOCK(x) int x = 0

#endif /* _LINUX_SPINLOCK_H */
