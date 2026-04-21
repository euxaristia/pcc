#define _POSIX_C_SOURCE 200809L
#include "hash.h"
#include <stdlib.h>
#include <string.h>

static unsigned long hash_str(const char *s) {
    unsigned long h = 5381;
    int c;
    while ((c = *s++))
        h = ((h << 5) + h) + c;
    return h;
}

HashTable *ht_create(size_t cap) {
    HashTable *ht = malloc(sizeof(HashTable));
    if (!ht) return NULL;
    ht->buckets = calloc(cap, sizeof(HashEntry *));
    if (!ht->buckets) {
        free(ht);
        return NULL;
    }
    ht->size = 0;
    ht->cap = cap;
    return ht;
}

void ht_free(HashTable *ht) {
    if (!ht) return;
    for (size_t i = 0; i < ht->cap; i++) {
        HashEntry *e = ht->buckets[i];
        while (e) {
            HashEntry *next = e->next;
            free(e->key);
            free(e);
            e = next;
        }
    }
    free(ht->buckets);
    free(ht);
}

void ht_insert(HashTable *ht, const char *key, void *value) {
    if (!ht || !key) return;
    unsigned long h = hash_str(key) % ht->cap;
    HashEntry *e = ht->buckets[h];
    while (e) {
        if (strcmp(e->key, key) == 0) {
            e->value = value;
            return;
        }
        e = e->next;
    }
    HashEntry *new_entry = malloc(sizeof(HashEntry));
    if (!new_entry) return;
    new_entry->key = strdup(key);
    new_entry->value = value;
    new_entry->next = ht->buckets[h];
    ht->buckets[h] = new_entry;
    ht->size++;
}

void *ht_get(HashTable *ht, const char *key) {
    if (!ht || !key) return NULL;
    unsigned long h = hash_str(key) % ht->cap;
    HashEntry *e = ht->buckets[h];
    while (e) {
        if (strcmp(e->key, key) == 0)
            return e->value;
        e = e->next;
    }
    return NULL;
}

bool ht_remove(HashTable *ht, const char *key) {
    if (!ht || !key) return false;
    unsigned long h = hash_str(key) % ht->cap;
    HashEntry *e = ht->buckets[h];
    HashEntry *prev = NULL;
    while (e) {
        if (strcmp(e->key, key) == 0) {
            if (prev)
                prev->next = e->next;
            else
                ht->buckets[h] = e->next;
            free(e->key);
            free(e);
            ht->size--;
            return true;
        }
        prev = e;
        e = e->next;
    }
    return false;
}

bool ht_contains(HashTable *ht, const char *key) {
    return ht_get(ht, key) != NULL;
}

void ht_foreach(HashTable *ht, void (*fn)(const char *key, void *value)) {
    if (!ht || !fn) return;
    for (size_t i = 0; i < ht->cap; i++) {
        HashEntry *e = ht->buckets[i];
        while (e) {
            fn(e->key, e->value);
            e = e->next;
        }
    }
}
