// Simulated kernel-like code from lib/string.c (preprocessed)
typedef unsigned long size_t;
typedef unsigned int u32;
typedef unsigned long u64;

// Simple tolower wrapper
int __tolower(int c) {
    if (c >= 'A' && c <= 'Z')
        return c + 32;
    return c;
}

int strncasecmp(const char *s1, const char *s2, size_t len)
{
	unsigned char c1, c2;

	if (!len)
		return 0;

	do {
		c1 = *s1++;
		c2 = *s2++;
		if (!c1 || !c2)
			break;
		if (c1 == c2)
			continue;
		c1 = __tolower(c1);
		c2 = __tolower(c2);
		if (c1 != c2)
			break;
		len = len - 1;
	} while (len > 0);
	return (int)c1 - (int)c2;
}

int strcasecmp(const char *s1, const char *s2)
{
	int c1, c2;

	do {
		c1 = __tolower(*s1++);
		c2 = __tolower(*s2++);
	} while (c1 == c2 && c1 != 0);
	return c1 - c2;
}

char *strcpy(char *dest, const char *src)
{
	char *tmp = dest;

	while ((*dest++ = *src++) != '\0')
		/* nothing */;
	return tmp;
}

char *strncpy(char *dest, const char *src, size_t count)
{
	char *tmp = dest;

	while (count > 0) {
		*dest = *src;
		if (!*src)
			break;
		dest++;
		src++;
		count = count - 1;
	}
	return tmp;
}

int strcmp(const char *cs, const char *ct)
{
	unsigned char c1, c2;

	while (1) {
		c1 = *cs++;
		c2 = *ct++;
		if (c1 != c2)
			return c1 < c2 ? -1 : 1;
		if (!c1)
			break;
	}
	return 0;
}

int strncmp(const char *cs, const char *ct, size_t count)
{
	unsigned char c1, c2;

	while (count > 0) {
		c1 = *cs++;
		c2 = *ct++;
		if (c1 != c2)
			return c1 < c2 ? -1 : 1;
		if (!c1)
			break;
		count = count - 1;
	}
	return 0;
}

size_t strlen(const char *s)
{
	const char *sc;

	for (sc = s; *sc != '\0'; ++sc)
		/* nothing */;
	return (size_t)(sc - s);
}

size_t strnlen(const char *s, size_t count)
{
	const char *sc;

	for (sc = s; *sc != '\0' && count > 0; ++sc)
		count = count - 1;
	return (size_t)(sc - s);
}

void *memset(void *s, int c, size_t count)
{
	unsigned char *p = (unsigned char *)s;
	while (count > 0) {
		*p = (unsigned char)c;
		p = p + 1;
		count = count - 1;
	}
	return s;
}

void *memcpy(void *d, const void *s, size_t count)
{
	unsigned char *dest = (unsigned char *)d;
	const unsigned char *src = (const unsigned char *)s;
	while (count > 0) {
		*dest = *src;
		dest = dest + 1;
		src = src + 1;
		count = count - 1;
	}
	return d;
}

void *memmove(void *d, const void *s, size_t count)
{
	unsigned char *dest = (unsigned char *)d;
	const unsigned char *src = (const unsigned char *)s;
	if (dest < src) {
		while (count > 0) {
			*dest = *src;
			dest = dest + 1;
			src = src + 1;
			count = count - 1;
		}
	} else {
		dest = dest + count;
		src = src + count;
		while (count > 0) {
			dest = dest - 1;
			src = src - 1;
			*dest = *src;
			count = count - 1;
		}
	}
	return d;
}

int memcmp(const void *s1, const void *s2, size_t count)
{
	const unsigned char *p1 = (const unsigned char *)s1;
	const unsigned char *p2 = (const unsigned char *)s2;
	int ret = 0;

	while (count > 0 && ret == 0) {
		ret = *p1 - *p2;
		p1 = p1 + 1;
		p2 = p2 + 1;
		count = count - 1;
	}
	return ret;
}

void *memchr(const void *s, int c, size_t n)
{
	const unsigned char *p = (const unsigned char *)s;
	while (n > 0 && *p != (unsigned char)c) {
		p = p + 1;
		n = n - 1;
	}
	if (n > 0)
		return (void *)p;
	return (void *)0;
}

int main(void) {
    char buf[64];
    strcpy(buf, "hello");
    int r = strcmp(buf, "hello");
    return r;
}
