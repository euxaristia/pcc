#include "arena.h"

Arena *arena_create(size_t cap) {
    Arena *a = malloc(sizeof(Arena));
    if (!a) return NULL;
    a->buf = malloc(cap);
    if (!a->buf) {
        free(a);
        return NULL;
    }
    a->len = 0;
    a->cap = cap;
    return a;
}

void *arena_alloc(Arena *a, size_t size) {
    if (!a || size == 0) return NULL;
    // Align to 8 bytes
    size_t align = (8 - (a->len % 8)) % 8;
    if (a->len + align + size > a->cap) {
        size_t new_cap = a->cap * 2 + align + size;
        char *new_buf = realloc(a->buf, new_cap);
        if (!new_buf) return NULL;
        a->buf = new_buf;
        a->cap = new_cap;
    }
    a->len += align;
    void *p = a->buf + a->len;
    a->len += size;
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
    free(a->buf);
    free(a);
}
