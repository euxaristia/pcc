#include "arena.h"
#include <stdlib.h>
#include <string.h>

typedef struct ArenaBlock {
    struct ArenaBlock *next;
    size_t cap;
    size_t used;
    char data[];
} ArenaBlock;

struct Arena {
    ArenaBlock *first;
    ArenaBlock *current;
};

Arena *arena_create(size_t cap) {
    if (cap == 0) cap = 1024;
    Arena *a = malloc(sizeof(Arena));
    if (!a) return NULL;
    ArenaBlock *b = malloc(sizeof(ArenaBlock) + cap);
    if (!b) {
        free(a);
        return NULL;
    }
    b->next = NULL;
    b->cap = cap;
    b->used = 0;
    a->first = b;
    a->current = b;
    return a;
}

void *arena_alloc(Arena *a, size_t size) {
    if (!a || size == 0) return NULL;
    size_t align = (8 - (a->current->used % 8)) % 8;
    size_t total = align + size;
    if (a->current->used + total > a->current->cap) {
        size_t new_cap = a->current->cap * 2;
        if (new_cap < total) new_cap = total;
        ArenaBlock *b = malloc(sizeof(ArenaBlock) + new_cap);
        if (!b) return NULL;
        b->next = NULL;
        b->cap = new_cap;
        b->used = 0;
        a->current->next = b;
        a->current = b;
        align = 0;
        total = size;
    }
    a->current->used += align;
    void *p = a->current->data + a->current->used;
    a->current->used += size;
    return p;
}

void *arena_calloc(Arena *a, size_t size) {
    void *p = arena_alloc(a, size);
    if (p) memset(p, 0, size);
    return p;
}

char *arena_strdup(Arena *a, const char *s) {
    if (!s) return NULL;
    size_t len = strlen(s);
    char *p = arena_alloc(a, len + 1);
    if (p) memcpy(p, s, len + 1);
    return p;
}

char *arena_strndup(Arena *a, const char *s, size_t n) {
    if (!s) return NULL;
    char *p = arena_alloc(a, n + 1);
    if (p) {
        memcpy(p, s, n);
        p[n] = '\0';
    }
    return p;
}

void arena_free(Arena *a) {
    if (!a) return;
    ArenaBlock *b = a->first;
    while (b) {
        ArenaBlock *next = b->next;
        free(b);
        b = next;
    }
    free(a);
}
