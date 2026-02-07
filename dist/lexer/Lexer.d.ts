export declare enum TokenType {
    INT = "int",
    CHAR = "char",
    VOID = "void",
    IF = "if",
    ELSE = "else",
    WHILE = "while",
    FOR = "for",
    RETURN = "return",
    STRUCT = "struct",
    IDENTIFIER = "IDENTIFIER",
    NUMBER = "NUMBER",
    STRING = "STRING",
    CHARACTER = "CHARACTER",
    PLUS = "+",
    MINUS = "-",
    MULTIPLY = "*",
    DIVIDE = "/",
    MODULO = "%",
    ASSIGN = "=",
    EQUAL = "==",
    NOT_EQUAL = "!=",
    LESS_THAN = "<",
    GREATER_THAN = ">",
    LESS_EQUAL = "<=",
    GREATER_EQUAL = ">=",
    AND = "&&",
    OR = "||",
    NOT = "!",
    BITWISE_AND = "&",
    BITWISE_OR = "|",
    BITWISE_XOR = "^",
    LEFT_SHIFT = "<<",
    RIGHT_SHIFT = ">>",
    INCREMENT = "++",
    DECREMENT = "--",
    SEMICOLON = ";",
    COMMA = ",",
    DOT = ".",
    COLON = ":",
    QUESTION = "?",
    LEFT_PAREN = "(",
    RIGHT_PAREN = ")",
    LEFT_BRACE = "{",
    RIGHT_BRACE = "}",
    LEFT_BRACKET = "[",
    RIGHT_BRACKET = "]",
    EOF = "EOF",
    NEWLINE = "NEWLINE",
    WHITESPACE = "WHITESPACE"
}
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
export declare class Lexer {
    private input;
    private position;
    private line;
    private column;
    private keywords;
    constructor(input: string);
    private peek;
    private advance;
    private skipWhitespace;
    private readNumber;
    private readIdentifier;
    private readString;
    private readOperator;
    private getOperatorTokenType;
    nextToken(): Token;
    tokenize(): Token[];
}
//# sourceMappingURL=Lexer.d.ts.map