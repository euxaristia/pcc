CC = cc
CFLAGS = -Wall -Wextra -Werror -g -O0 -std=c99 -I.
LDFLAGS =

PREPROC_SRCS = arena.c vector.c hash.c pp.c
PREPROC_OBJS = $(PREPROC_SRCS:.c=.o)

TEST_SRCS = $(PREPROC_SRCS) test.c
TEST_OBJS = $(TEST_SRCS:.c=.o)

.PHONY: all clean test cpp

all: test_pp cpp

test_pp: $(TEST_OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

cpp: $(PREPROC_OBJS) ../cpp.c
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test: test_pp
	./test_pp

clean:
	rm -f $(TEST_OBJS) test_pp cpp

# Valgrind check for memory leaks
memcheck: test_pp
	valgrind --leak-check=full --show-leak-kinds=all --error-exitcode=1 ./test_pp
