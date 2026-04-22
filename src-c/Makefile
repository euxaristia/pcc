CC = cc
CFLAGS = -Wall -Wextra -Werror -g -O0 -std=c99 -I.

# Preprocessor
PREPROC_OBJS = preprocessor/arena.o preprocessor/vector.o preprocessor/hash.o preprocessor/pp.o

# Lexer
LEXER_OBJS = lexer/lexer.o

# Parser
PARSER_OBJS = parser/parser.o

.PHONY: all clean test

all: test_lexer test_parser cpp

# Lexer tests
test_lexer: lexer/test_lexer.c lexer/lexer.o
	$(CC) $(CFLAGS) -o $@ $^

# Parser tests
test_parser: parser/test_parser.c parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# C preprocessor CLI
cpp: $(PREPROC_OBJS) cpp.c
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test: test_lexer test_parser
	./test_lexer
	./test_parser

clean:
	rm -f $(PREPROC_OBJS) $(LEXER_OBJS) $(PARSER_OBJS)
	rm -f test_lexer test_parser cpp
	rm -f preprocessor/test_pp preprocessor/cpp preprocessor/*.o
