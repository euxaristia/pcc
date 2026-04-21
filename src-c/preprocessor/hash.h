#ifndef HASH_H
#define HASH_H

#include <stddef.h>
#include <stdbool.h>

// Simple hash table with string keys.
typedef struct HashEntry {
    char *key;
    void *value;
    struct HashEntry *next;
} HashEntry;

typedef struct HashTable {
    HashEntry **buckets;
    size_t size;
    size_t cap;
} HashTable;

HashTable *ht_create(size_t cap);
void ht_free(HashTable *ht);
void ht_insert(HashTable *ht, const char *key, void *value);
void *ht_get(HashTable *ht, const char *key);
bool ht_remove(HashTable *ht, const char *key);
bool ht_contains(HashTable *ht, const char *key);
void ht_foreach(HashTable *ht, void (*fn)(const char *key, void *value));

#endif // HASH_H
