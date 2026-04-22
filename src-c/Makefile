CC = cc
CFLAGS = -Wall -Wextra -Werror -g -O0 -std=c99 -I.

# Preprocessor
PREPROC_OBJS = preprocessor/arena.o preprocessor/vector.o preprocessor/hash.o preprocessor/pp.o

# Lexer
LEXER_OBJS = lexer/lexer.o

# Parser
PARSER_OBJS = parser/parser.o

# Semantic
SEMANTIC_OBJS = semantic/semantic.o

# Codegen
CODEGEN_OBJS = codegen/ir.o codegen/irgen.o

.PHONY: all clean test

all: test_lexer test_parser test_semantic test_irgen cpp

# Lexer tests
test_lexer: lexer/test_lexer.c lexer/lexer.o
	$(CC) $(CFLAGS) -o $@ $^

# Parser tests
test_parser: parser/test_parser.c parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# Semantic analyzer tests
test_semantic: semantic/test_semantic.c semantic/semantic.o parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# C preprocessor CLI
cpp: $(PREPROC_OBJS) cpp.c
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# IR generator tests
test_irgen: codegen/test_irgen.c $(CODEGEN_OBJS) semantic/semantic.o parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

test: test_lexer test_parser test_semantic test_irgen
	./test_lexer
	./test_parser
	./test_semantic
	./test_irgen

clean:
	rm -f $(PREPROC_OBJS) $(LEXER_OBJS) $(PARSER_OBJS) $(SEMANTIC_OBJS) $(CODEGEN_OBJS)
	rm -f test_lexer test_parser test_semantic test_irgen cpp
	rm -f preprocessor/test_pp preprocessor/cpp preprocessor/*.o
