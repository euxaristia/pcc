#ifndef VECTOR_H
#define VECTOR_H

#include <stddef.h>

// Generic dynamic array.
typedef struct Vector {
    void **data;
    size_t len;
    size_t cap;
} Vector;

Vector *vec_create(void);
void vec_free(Vector *v);
void vec_push(Vector *v, void *item);
void *vec_pop(Vector *v);
void *vec_get(Vector *v, size_t idx);
void vec_set(Vector *v, size_t idx, void *item);
void vec_clear(Vector *v);

#endif // VECTOR_H
