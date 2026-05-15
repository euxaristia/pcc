CC = cc
CFLAGS = -Wall -Wextra -Werror -g -O0 -std=c99 -I.
LDFLAGS =

# Preprocessor
PREPROC_OBJS = preprocessor/arena.o preprocessor/vector.o preprocessor/hash.o preprocessor/pp.o

# Lexer
LEXER_OBJS = lexer/lexer.o

# Parser
PARSER_OBJS = parser/parser.o

# Semantic
SEMANTIC_OBJS = semantic/semantic.o

# Codegen
CODEGEN_OBJS = codegen/ir.o codegen/irgen.o codegen/target.o codegen/asmgen.o codegen/asmgen_arm64.o codegen/elf.o

# All backend objects
BACKEND_OBJS = $(CODEGEN_OBJS) $(SEMANTIC_OBJS) $(PARSER_OBJS) $(LEXER_OBJS) $(PREPROC_OBJS)

.PHONY: all clean test

all: pcc test_lexer test_parser test_semantic test_irgen test_asmgen test_elf test_cli test_integration test_pp cpp

# Main compiler executable
pcc: pcc.c $(BACKEND_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

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

# IR generator tests
test_irgen: codegen/test_irgen.c $(CODEGEN_OBJS) semantic/semantic.o parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# x86-64 assembly generator tests
test_asmgen: codegen/test_asmgen.c $(CODEGEN_OBJS) semantic/semantic.o parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# ELF generator tests
test_elf: codegen/test_elf.c $(CODEGEN_OBJS) semantic/semantic.o parser/parser.o lexer/lexer.o $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

# CLI tests (depend on pcc binary)
test_cli: test_cli.c pcc
	$(CC) $(CFLAGS) -o $@ test_cli.c

# Integration tests (depend on pcc binary)
test_integration: test_integration.c pcc
	$(CC) $(CFLAGS) -o $@ test_integration.c

# Preprocessor tests
test_pp: preprocessor/test.c $(PREPROC_OBJS)
	$(CC) $(CFLAGS) -Ipreprocessor -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test: test_lexer test_parser test_semantic test_irgen test_asmgen test_elf test_pp test_cli test_integration
	./test_lexer
	./test_parser
	./test_semantic
	./test_irgen
	./test_asmgen
	./test_elf
	./test_pp
	./test_cli
	./test_integration

clean:
	rm -f $(PREPROC_OBJS) $(LEXER_OBJS) $(PARSER_OBJS) $(SEMANTIC_OBJS) $(CODEGEN_OBJS)
	rm -f test_lexer test_parser test_semantic test_irgen test_asmgen test_elf test_cli test_integration cpp pcc
	rm -f preprocessor/test_pp preprocessor/cpp preprocessor/*.o
