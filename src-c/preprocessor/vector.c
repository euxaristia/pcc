#include "vector.h"
#include <stdlib.h>

Vector *vec_create(void) {
    Vector *v = malloc(sizeof(Vector));
    if (!v) return NULL;
    v->data = malloc(sizeof(void *) * 8);
    if (!v->data) {
        free(v);
        return NULL;
    }
    v->len = 0;
    v->cap = 8;
    return v;
}

void vec_free(Vector *v) {
    if (!v) return;
    free(v->data);
    free(v);
}

void vec_push(Vector *v, void *item) {
    if (!v) return;
    if (v->len >= v->cap) {
        size_t new_cap = v->cap * 2;
        void **new_data = realloc(v->data, sizeof(void *) * new_cap);
        if (!new_data) return;
        v->data = new_data;
        v->cap = new_cap;
    }
    v->data[v->len++] = item;
}

void *vec_pop(Vector *v) {
    if (!v || v->len == 0) return NULL;
    return v->data[--v->len];
}

void *vec_get(Vector *v, size_t idx) {
    if (!v || idx >= v->len) return NULL;
    return v->data[idx];
}

void vec_set(Vector *v, size_t idx, void *item) {
    if (!v || idx >= v->len) return;
    v->data[idx] = item;
}

void vec_clear(Vector *v) {
    if (!v) return;
    v->len = 0;
}
