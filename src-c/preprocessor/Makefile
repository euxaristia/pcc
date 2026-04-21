CC = cc
CFLAGS = -Wall -Wextra -Werror -g -O0 -std=c99 -I.
LDFLAGS =

SRCS = arena.c vector.c hash.c pp.c test.c
OBJS = $(SRCS:.c=.o)
TARGET = test_pp

.PHONY: all clean test

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(OBJS) $(TARGET)

# Valgrind check for memory leaks
memcheck: $(TARGET)
	valgrind --leak-check=full --show-leak-kinds=all --error-exitcode=1 ./$(TARGET)
