#ifndef ARENA_H
#define ARENA_H

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// Simple bump allocator.
// All allocations are freed at once by freeing the arena.
typedef struct Arena {
    char *buf;
    size_t len;
    size_t cap;
} Arena;

// Create a new arena with initial capacity.
Arena *arena_create(size_t cap);

// Allocate `size` bytes from the arena.
void *arena_alloc(Arena *a, size_t size);

// Allocate `size` bytes and zero them.
void *arena_calloc(Arena *a, size_t size);

// Duplicate a null-terminated string into the arena.
char *arena_strdup(Arena *a, const char *s);

// Duplicate `n` bytes into the arena (null-terminated).
char *arena_strndup(Arena *a, const char *s, size_t n);

// Free the entire arena.
void arena_free(Arena *a);

#endif // ARENA_H
