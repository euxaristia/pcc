"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.NodeType = void 0;
const Lexer_1 = require("../lexer/Lexer");
var NodeType;
(function (NodeType) {
    // Program structure
    NodeType["PROGRAM"] = "PROGRAM";
    NodeType["FUNCTION_DECLARATION"] = "FUNCTION_DECLARATION";
    NodeType["PARAMETER_LIST"] = "PARAMETER_LIST";
    NodeType["PARAMETER"] = "PARAMETER";
    NodeType["COMPOUND_STATEMENT"] = "COMPOUND_STATEMENT";
    // Statements
    NodeType["DECLARATION"] = "DECLARATION";
    NodeType["ASSIGNMENT"] = "ASSIGNMENT";
    NodeType["IF_STATEMENT"] = "IF_STATEMENT";
    NodeType["WHILE_STATEMENT"] = "WHILE_STATEMENT";
    NodeType["FOR_STATEMENT"] = "FOR_STATEMENT";
    NodeType["RETURN_STATEMENT"] = "RETURN_STATEMENT";
    NodeType["EXPRESSION_STATEMENT"] = "EXPRESSION_STATEMENT";
    // Expressions
    NodeType["BINARY_EXPRESSION"] = "BINARY_EXPRESSION";
    NodeType["UNARY_EXPRESSION"] = "UNARY_EXPRESSION";
    NodeType["FUNCTION_CALL"] = "FUNCTION_CALL";
    NodeType["ARGUMENT_LIST"] = "ARGUMENT_LIST";
    // Literals and identifiers
    NodeType["IDENTIFIER"] = "IDENTIFIER";
    NodeType["NUMBER_LITERAL"] = "NUMBER_LITERAL";
    NodeType["STRING_LITERAL"] = "STRING_LITERAL";
    NodeType["CHARACTER_LITERAL"] = "CHARACTER_LITERAL";
    // Types
    NodeType["TYPE_SPECIFIER"] = "TYPE_SPECIFIER";
    // Assembly
    NodeType["ASM_STATEMENT"] = "ASM_STATEMENT";
    // Attributes
    NodeType["EXPORT_SYMBOL_STMT"] = "EXPORT_SYMBOL_STMT";
    NodeType["ATTRIBUTE_STMT"] = "ATTRIBUTE_STMT";
    NodeType["PREPROCESSOR_STMT"] = "PREPROCESSOR_STMT";
    // Unary expressions
    NodeType["SIZEOF_EXPRESSION"] = "SIZEOF_EXPRESSION";
    // Cast expression
    NodeType["CAST_EXPRESSION"] = "CAST_EXPRESSION";
    // Array access
    NodeType["ARRAY_ACCESS"] = "ARRAY_ACCESS";
    // Member access
    NodeType["MEMBER_ACCESS"] = "MEMBER_ACCESS";
})(NodeType || (exports.NodeType = NodeType = {}));
class Parser {
    constructor(tokens) {
        this.current = 0;
        this.tokens = tokens;
    }
    peek() {
        if (this.current >= this.tokens.length) {
            return { type: Lexer_1.TokenType.EOF, value: '', line: 0, column: 0 };
        }
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    isAtEnd() {
        return this.peek().type === Lexer_1.TokenType.EOF;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw new Error(`${message}. Got ${this.peek().type} at line ${this.peek().line}, column ${this.peek().column}`);
    }
    error(token, message) {
        throw new Error(`${message} at line ${token.line}, column ${token.column}`);
    }
    parse() {
        const declarations = [];
        while (!this.isAtEnd()) {
            if (this.check(Lexer_1.TokenType.NEWLINE)) {
                this.advance();
                continue;
            }
            // Skip attributes like __init
            if (this.check(Lexer_1.TokenType.INIT)) {
                this.advance();
                continue;
            }
            // Skip EXPORT_SYMBOL and other kernel directives
            if (this.check(Lexer_1.TokenType.EXPORT_SYMBOL) || this.check(Lexer_1.TokenType.ASM)) {
                const statement = this.parseStatement();
                if (statement) {
                    declarations.push(statement);
                }
                continue;
            }
            if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) || this.check(Lexer_1.TokenType.VOID) ||
                this.check(Lexer_1.TokenType.STRUCT) || this.check(Lexer_1.TokenType.UNSIGNED) || this.check(Lexer_1.TokenType.SIGNED) ||
                this.check(Lexer_1.TokenType.LONG) || this.check(Lexer_1.TokenType.SHORT)) {
                // Special handling for struct definitions
                if (this.check(Lexer_1.TokenType.STRUCT)) {
                    const savedPosition = this.current;
                    this.advance(); // consume 'struct'
                    if (this.check(Lexer_1.TokenType.IDENTIFIER)) {
                        this.advance(); // consume struct name
                        if (this.check(Lexer_1.TokenType.LEFT_BRACE)) {
                            // This is a struct definition, not a variable declaration
                            // Backtrack and parse as type specifier
                            this.current = savedPosition;
                            this.parseTypeSpecifier();
                            continue; // Skip to next iteration, struct definition handled
                        }
                    }
                    // Not a struct definition, backtrack
                    this.current = savedPosition;
                }
                const declaration = this.parseDeclaration();
                if (declaration) {
                    declarations.push(declaration);
                }
            }
            else {
                this.error(this.peek(), 'Expected declaration');
            }
        }
        return {
            type: NodeType.PROGRAM,
            declarations,
        };
    }
    parseDeclaration() {
        const typeSpecifier = this.parseTypeSpecifier();
        const name = this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected identifier after type');
        if (this.check(Lexer_1.TokenType.LEFT_PAREN)) {
            return this.parseFunctionDeclaration(typeSpecifier, name.value);
        }
        else if (this.check(Lexer_1.TokenType.SEMICOLON) || this.check(Lexer_1.TokenType.ASSIGN)) {
            return this.parseVariableDeclaration(typeSpecifier, name.value);
        }
        else {
            this.error(this.peek(), 'Expected function declaration or variable declaration');
            return null;
        }
    }
    parseTypeSpecifier() {
        const token = this.advance();
        let typeName = token.value;
        // Handle struct types
        if (token.type === Lexer_1.TokenType.STRUCT) {
            this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected struct name');
            const structName = this.previous().value;
            typeName = `struct ${structName}`;
            // Check for struct body definition: struct Point { int x; int y; };
            if (this.check(Lexer_1.TokenType.LEFT_BRACE)) {
                // Parse struct body
                this.advance(); // consume '{'
                while (!this.check(Lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
                    if (this.check(Lexer_1.TokenType.NEWLINE)) {
                        this.advance();
                        continue;
                    }
                    // Parse member declaration
                    if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) ||
                        this.check(Lexer_1.TokenType.VOID) || this.check(Lexer_1.TokenType.STRUCT) ||
                        this.check(Lexer_1.TokenType.LONG) || this.check(Lexer_1.TokenType.SHORT) ||
                        this.check(Lexer_1.TokenType.UNSIGNED) || this.check(Lexer_1.TokenType.SIGNED)) {
                        const memberType = this.parseTypeSpecifier();
                        const memberName = this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected member name');
                        // Handle array members
                        if (this.match(Lexer_1.TokenType.LEFT_BRACKET)) {
                            if (!this.check(Lexer_1.TokenType.RIGHT_BRACKET)) {
                                this.parseExpression(); // parse array size
                            }
                            this.consume(Lexer_1.TokenType.RIGHT_BRACKET, "Expected ']' after array size");
                        }
                        this.consume(Lexer_1.TokenType.SEMICOLON, "Expected ';' after member declaration");
                    }
                }
                this.consume(Lexer_1.TokenType.RIGHT_BRACE, "Expected '}' after struct body");
                // After struct body, there might be variable declarations
                // e.g., struct Point { ... } p1, p2;
                // For now, we consume any variable names
                while (this.check(Lexer_1.TokenType.IDENTIFIER)) {
                    this.advance(); // consume variable name
                    if (this.check(Lexer_1.TokenType.COMMA)) {
                        this.advance();
                    }
                    else {
                        break;
                    }
                }
                // Consume semicolon after struct definition if present
                if (this.check(Lexer_1.TokenType.SEMICOLON)) {
                    this.advance();
                }
            }
        }
        // Handle compound type specifiers
        // unsigned int, unsigned long, unsigned long long, signed int, etc.
        if (token.type === Lexer_1.TokenType.UNSIGNED || token.type === Lexer_1.TokenType.SIGNED) {
            if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.LONG) ||
                this.check(Lexer_1.TokenType.SHORT) || this.check(Lexer_1.TokenType.CHAR)) {
                const nextToken = this.advance();
                typeName = `${typeName} ${nextToken.value}`;
                // Handle long long
                if (nextToken.type === Lexer_1.TokenType.LONG && this.check(Lexer_1.TokenType.LONG)) {
                    this.advance();
                    typeName = `${typeName} long`;
                }
            }
        }
        else if (token.type === Lexer_1.TokenType.LONG) {
            // Handle long long
            if (this.check(Lexer_1.TokenType.LONG)) {
                this.advance();
                typeName = 'long long';
            }
            // Handle long int
            if (this.check(Lexer_1.TokenType.INT)) {
                this.advance();
            }
        }
        else if (token.type === Lexer_1.TokenType.SHORT) {
            // Handle short int
            if (this.check(Lexer_1.TokenType.INT)) {
                this.advance();
            }
        }
        let pointerCount = 0;
        // Count pointer modifiers
        while (this.match(Lexer_1.TokenType.MULTIPLY)) {
            pointerCount++;
        }
        return {
            type: NodeType.TYPE_SPECIFIER,
            typeName,
            isPointer: pointerCount > 0,
            pointerCount,
            line: token.line,
            column: token.column,
        };
    }
    parseFunctionDeclaration(returnType, name) {
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after function name');
        const parameters = this.parseParameters();
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after parameters');
        const body = this.parseCompoundStatement();
        return {
            type: NodeType.FUNCTION_DECLARATION,
            returnType,
            name,
            parameters,
            body,
            line: returnType.line,
            column: returnType.column,
        };
    }
    parseParameters() {
        const parameters = [];
        if (!this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
            do {
                const paramType = this.parseTypeSpecifier();
                // Handle void parameter (int func(void))
                if (paramType.typeName === 'void') {
                    // If the next token is not a comma and not a closing paren, 
                    // then this void was not a standalone parameter
                    if (!this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                        throw new Error('void must be the only parameter');
                    }
                    return []; // Return empty parameter list for void
                }
                const paramName = this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected parameter name');
                parameters.push({
                    type: NodeType.PARAMETER,
                    varType: paramType,
                    name: paramName.value,
                    line: paramType.line,
                    column: paramType.column,
                });
            } while (this.match(Lexer_1.TokenType.COMMA));
        }
        return parameters;
    }
    parseVariableDeclaration(varType, name) {
        let initializer;
        let arraySize;
        // Check for array declaration: int arr[5];
        if (this.match(Lexer_1.TokenType.LEFT_BRACKET)) {
            if (!this.check(Lexer_1.TokenType.RIGHT_BRACKET)) {
                arraySize = this.parseExpression();
            }
            this.consume(Lexer_1.TokenType.RIGHT_BRACKET, "Expected ']' after array size");
            // Update type to be an array
            varType = {
                ...varType,
                isPointer: true,
                pointerCount: varType.pointerCount + 1,
            };
        }
        if (this.match(Lexer_1.TokenType.ASSIGN)) {
            initializer = this.parseExpression();
        }
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after variable declaration');
        return {
            type: NodeType.DECLARATION,
            varType,
            name,
            initializer,
            line: varType.line,
            column: varType.column,
        };
    }
    parseCompoundStatement() {
        this.consume(Lexer_1.TokenType.LEFT_BRACE, 'Expected \'{\' to start compound statement');
        const statements = [];
        while (!this.check(Lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            if (this.check(Lexer_1.TokenType.NEWLINE)) {
                this.advance();
                continue;
            }
            statements.push(this.parseStatement());
        }
        this.consume(Lexer_1.TokenType.RIGHT_BRACE, 'Expected \'}\' to end compound statement');
        return {
            type: NodeType.COMPOUND_STATEMENT,
            statements,
            line: statements[0]?.line || 0,
            column: statements[0]?.column || 0,
        };
    }
    parseStatement() {
        // Declaration
        if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) || this.check(Lexer_1.TokenType.VOID) ||
            this.check(Lexer_1.TokenType.STRUCT) || this.check(Lexer_1.TokenType.UNSIGNED) || this.check(Lexer_1.TokenType.SIGNED) ||
            this.check(Lexer_1.TokenType.LONG) || this.check(Lexer_1.TokenType.SHORT)) {
            const typeSpecifier = this.parseTypeSpecifier();
            const name = this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected identifier after type');
            return this.parseVariableDeclaration(typeSpecifier, name.value);
        }
        // If statement
        if (this.match(Lexer_1.TokenType.IF)) {
            return this.parseIfStatement();
        }
        // While statement
        if (this.match(Lexer_1.TokenType.WHILE)) {
            return this.parseWhileStatement();
        }
        // For statement
        if (this.match(Lexer_1.TokenType.FOR)) {
            return this.parseForStatement();
        }
        // Return statement
        if (this.match(Lexer_1.TokenType.RETURN)) {
            return this.parseReturnStatement();
        }
        // Inline assembly
        if (this.match(Lexer_1.TokenType.ASM)) {
            return this.parseAsmStatement();
        }
        // EXPORT_SYMBOL
        if (this.match(Lexer_1.TokenType.EXPORT_SYMBOL)) {
            return this.parseExportSymbol();
        }
        // Attributes like __init - skip for now and let next declaration handle it
        if (this.match(Lexer_1.TokenType.INIT)) {
            // Skip __init attribute and let the next function declaration handle it
            // This is a simplified approach
        }
        // Preprocessor directives
        if (this.match(Lexer_1.TokenType.PREPROCESSOR)) {
            return this.parsePreprocessor();
        }
        // Compound statement
        if (this.check(Lexer_1.TokenType.LEFT_BRACE)) {
            return this.parseCompoundStatement();
        }
        // Expression statement
        return this.parseExpressionStatement();
    }
    parseIfStatement() {
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after if');
        const condition = this.parseExpression();
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after if condition');
        const thenBranch = this.parseStatement();
        let elseBranch;
        if (this.match(Lexer_1.TokenType.ELSE)) {
            elseBranch = this.parseStatement();
        }
        return {
            type: NodeType.IF_STATEMENT,
            condition,
            thenBranch,
            elseBranch,
            line: thenBranch.line,
            column: thenBranch.column,
        };
    }
    parseWhileStatement() {
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after while');
        const condition = this.parseExpression();
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after while condition');
        const body = this.parseStatement();
        return {
            type: NodeType.WHILE_STATEMENT,
            condition,
            body,
            line: body.line,
            column: body.column,
        };
    }
    parseForStatement() {
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after for');
        let initialization;
        if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) || this.check(Lexer_1.TokenType.VOID)) {
            const typeSpecifier = this.parseTypeSpecifier();
            const name = this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected identifier after type');
            initialization = this.parseVariableDeclaration(typeSpecifier, name.value);
        }
        else if (!this.check(Lexer_1.TokenType.SEMICOLON)) {
            initialization = this.parseExpressionStatement();
        }
        else {
            this.advance(); // Skip semicolon
        }
        let condition;
        if (!this.check(Lexer_1.TokenType.SEMICOLON)) {
            condition = this.parseExpression();
        }
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after for condition');
        let increment;
        if (!this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
            increment = this.parseExpression();
        }
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after for clauses');
        const body = this.parseStatement();
        return {
            type: NodeType.FOR_STATEMENT,
            initialization,
            condition,
            increment,
            body,
            line: body.line,
            column: body.column,
        };
    }
    parseReturnStatement() {
        let value;
        if (!this.check(Lexer_1.TokenType.SEMICOLON)) {
            value = this.parseExpression();
        }
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after return');
        return {
            type: NodeType.RETURN_STATEMENT,
            value,
            line: value?.line || 0,
            column: value?.column || 0,
        };
    }
    parseExpressionStatement() {
        const expression = this.parseExpression();
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after expression');
        return {
            type: NodeType.EXPRESSION_STATEMENT,
            expression,
            line: expression.line,
            column: expression.column,
        };
    }
    parseExpression() {
        return this.parseAssignment();
    }
    parseAssignment() {
        const expr = this.parseLogicalOr();
        if (this.match(Lexer_1.TokenType.ASSIGN)) {
            const value = this.parseAssignment();
            // Allow assignment to identifiers, member access, and array access
            if (expr.type === NodeType.IDENTIFIER ||
                expr.type === NodeType.MEMBER_ACCESS ||
                expr.type === NodeType.ARRAY_ACCESS) {
                return {
                    type: NodeType.ASSIGNMENT,
                    target: expr,
                    value,
                    line: expr.line,
                    column: expr.column,
                };
            }
            this.error(this.previous(), 'Invalid assignment target');
        }
        return expr;
    }
    parseLogicalOr() {
        let expr = this.parseLogicalAnd();
        while (this.match(Lexer_1.TokenType.OR)) {
            const operator = this.previous().value;
            const right = this.parseLogicalAnd();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseLogicalAnd() {
        let expr = this.parseEquality();
        while (this.match(Lexer_1.TokenType.AND)) {
            const operator = this.previous().value;
            const right = this.parseEquality();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseEquality() {
        let expr = this.parseRelational();
        while (this.match(Lexer_1.TokenType.EQUAL, Lexer_1.TokenType.NOT_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseRelational();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseRelational() {
        let expr = this.parseShift();
        while (this.match(Lexer_1.TokenType.LESS_THAN, Lexer_1.TokenType.GREATER_THAN, Lexer_1.TokenType.LESS_EQUAL, Lexer_1.TokenType.GREATER_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseShift();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseShift() {
        let expr = this.parseAdditive();
        while (this.match(Lexer_1.TokenType.LEFT_SHIFT, Lexer_1.TokenType.RIGHT_SHIFT)) {
            const operator = this.previous().value;
            const right = this.parseAdditive();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseAdditive() {
        let expr = this.parseMultiplicative();
        while (this.match(Lexer_1.TokenType.PLUS, Lexer_1.TokenType.MINUS)) {
            const operator = this.previous().value;
            const right = this.parseMultiplicative();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseMultiplicative() {
        let expr = this.parseUnary();
        while (this.match(Lexer_1.TokenType.MULTIPLY, Lexer_1.TokenType.DIVIDE, Lexer_1.TokenType.MODULO)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            expr = {
                type: NodeType.BINARY_EXPRESSION,
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
        }
        return expr;
    }
    parseUnary() {
        // Handle type casting: (type) expression
        if (this.check(Lexer_1.TokenType.LEFT_PAREN)) {
            const savedPosition = this.current;
            this.advance(); // consume '('
            // Check if it's a type cast by looking for a type keyword
            if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) ||
                this.check(Lexer_1.TokenType.VOID) || this.check(Lexer_1.TokenType.STRUCT) ||
                this.check(Lexer_1.TokenType.LONG) || this.check(Lexer_1.TokenType.SHORT) ||
                this.check(Lexer_1.TokenType.UNSIGNED) || this.check(Lexer_1.TokenType.SIGNED)) {
                // It's a type cast
                const targetType = this.parseTypeSpecifier();
                this.consume(Lexer_1.TokenType.RIGHT_PAREN, "Expected ')' after type in cast");
                const operand = this.parseUnary(); // Cast has high precedence
                return {
                    type: NodeType.CAST_EXPRESSION,
                    targetType,
                    operand,
                    line: targetType.line,
                    column: targetType.column,
                };
            }
            else {
                // Not a type cast, backtrack and parse as parenthesized expression
                this.current = savedPosition;
            }
        }
        if (this.match(Lexer_1.TokenType.NOT, Lexer_1.TokenType.MINUS, Lexer_1.TokenType.BITWISE_AND, Lexer_1.TokenType.MULTIPLY)) {
            const operator = this.previous().value;
            const operand = this.parseUnary();
            return {
                type: NodeType.UNARY_EXPRESSION,
                operator,
                operand,
                line: operand.line,
                column: operand.column,
            };
        }
        // Handle sizeof operator
        if (this.match(Lexer_1.TokenType.SIZEOF)) {
            return this.parseSizeof();
        }
        return this.parsePostfix();
    }
    parseSizeof() {
        const line = this.previous().line;
        const column = this.previous().column;
        // sizeof(type) or sizeof expression
        if (this.match(Lexer_1.TokenType.LEFT_PAREN)) {
            // Check if it's a type or an expression
            if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) ||
                this.check(Lexer_1.TokenType.VOID) || this.check(Lexer_1.TokenType.STRUCT)) {
                // It's sizeof(type)
                const typeSpec = this.parseTypeSpecifier();
                this.consume(Lexer_1.TokenType.RIGHT_PAREN, "Expected ')' after type in sizeof");
                return {
                    type: NodeType.SIZEOF_EXPRESSION,
                    operand: typeSpec,
                    isType: true,
                    line,
                    column,
                };
            }
            else {
                // It's sizeof(expression)
                const expr = this.parseExpression();
                this.consume(Lexer_1.TokenType.RIGHT_PAREN, "Expected ')' after expression in sizeof");
                return {
                    type: NodeType.SIZEOF_EXPRESSION,
                    operand: expr,
                    isType: false,
                    line,
                    column,
                };
            }
        }
        else {
            // sizeof expression without parentheses
            const expr = this.parseUnary();
            return {
                type: NodeType.SIZEOF_EXPRESSION,
                operand: expr,
                isType: false,
                line,
                column,
            };
        }
    }
    parsePostfix() {
        let expr = this.parsePrimary();
        while (true) {
            // Array subscript: arr[index]
            if (this.match(Lexer_1.TokenType.LEFT_BRACKET)) {
                const index = this.parseExpression();
                this.consume(Lexer_1.TokenType.RIGHT_BRACKET, "Expected ']' after array index");
                expr = {
                    type: NodeType.ARRAY_ACCESS,
                    array: expr,
                    index: index,
                    line: expr.line,
                    column: expr.column,
                };
            }
            else if (this.match(Lexer_1.TokenType.LEFT_PAREN)) {
                const args = [];
                if (!this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(Lexer_1.TokenType.COMMA));
                }
                this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after arguments');
                expr = {
                    type: NodeType.FUNCTION_CALL,
                    name: expr.name,
                    arguments: args,
                    line: expr.line,
                    column: expr.column,
                };
            }
            else if (this.match(Lexer_1.TokenType.DOT)) {
                // Member access: obj.member
                const memberToken = this.consume(Lexer_1.TokenType.IDENTIFIER, "Expected member name after '.'");
                expr = {
                    type: NodeType.MEMBER_ACCESS,
                    object: expr,
                    member: memberToken.value,
                    line: expr.line,
                    column: expr.column,
                };
            }
            else if (this.match(Lexer_1.TokenType.INCREMENT) || this.match(Lexer_1.TokenType.DECREMENT)) {
                const operator = this.previous().value;
                expr = {
                    type: NodeType.UNARY_EXPRESSION,
                    operator: operator + '_post', // Mark as postfix
                    operand: expr,
                    line: expr.line,
                    column: expr.column,
                };
            }
            else {
                break;
            }
        }
        return expr;
    }
    parsePrimary() {
        if (this.match(Lexer_1.TokenType.NUMBER)) {
            const token = this.previous();
            return {
                type: NodeType.NUMBER_LITERAL,
                value: token.value,
                line: token.line,
                column: token.column,
            };
        }
        if (this.match(Lexer_1.TokenType.STRING)) {
            const token = this.previous();
            return {
                type: NodeType.STRING_LITERAL,
                value: token.value,
                line: token.line,
                column: token.column,
            };
        }
        if (this.match(Lexer_1.TokenType.CHARACTER)) {
            const token = this.previous();
            return {
                type: NodeType.CHARACTER_LITERAL,
                value: token.value,
                line: token.line,
                column: token.column,
            };
        }
        if (this.match(Lexer_1.TokenType.IDENTIFIER)) {
            const token = this.previous();
            return {
                type: NodeType.IDENTIFIER,
                name: token.value,
                line: token.line,
                column: token.column,
            };
        }
        if (this.match(Lexer_1.TokenType.LEFT_PAREN)) {
            const expr = this.parseExpression();
            this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after expression');
            return expr;
        }
        this.error(this.peek(), 'Expected expression');
        throw new Error('Unreachable');
    }
    parseAsmStatement() {
        const isVolatile = this.match(Lexer_1.TokenType.VOLATILE);
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after asm');
        this.consume(Lexer_1.TokenType.STRING, 'Expected string literal with assembly code');
        const assembly = this.previous().value;
        // Parse optional output operands (starts with ':')
        if (this.match(Lexer_1.TokenType.COLON)) {
            // Skip output operands - they are comma-separated constraint expressions
            while (!this.check(Lexer_1.TokenType.COLON) && !this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                if (this.match(Lexer_1.TokenType.COMMA)) {
                    continue;
                }
                // Skip constraint strings and expressions
                if (this.check(Lexer_1.TokenType.STRING)) {
                    this.advance();
                }
                else if (this.check(Lexer_1.TokenType.LEFT_PAREN)) {
                    // Skip parenthesized expression
                    this.advance();
                    while (!this.check(Lexer_1.TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
                        this.advance();
                    }
                    if (this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                        this.advance();
                    }
                }
                else {
                    this.advance();
                }
            }
        }
        // Parse optional input operands (starts with ':')
        if (this.match(Lexer_1.TokenType.COLON)) {
            // Skip input operands - they are comma-separated constraint expressions
            while (!this.check(Lexer_1.TokenType.COLON) && !this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                if (this.match(Lexer_1.TokenType.COMMA)) {
                    continue;
                }
                // Skip constraint strings and expressions
                if (this.check(Lexer_1.TokenType.STRING)) {
                    this.advance();
                }
                else if (this.check(Lexer_1.TokenType.LEFT_PAREN)) {
                    // Skip parenthesized expression
                    this.advance();
                    while (!this.check(Lexer_1.TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
                        this.advance();
                    }
                    if (this.check(Lexer_1.TokenType.RIGHT_PAREN)) {
                        this.advance();
                    }
                }
                else {
                    this.advance();
                }
            }
        }
        // Parse optional clobbered registers (starts with ':')
        if (this.match(Lexer_1.TokenType.COLON)) {
            // Skip clobber list - comma-separated strings
            while (!this.check(Lexer_1.TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
                if (this.match(Lexer_1.TokenType.COMMA)) {
                    continue;
                }
                this.advance();
            }
        }
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after assembly');
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after asm statement');
        return {
            type: NodeType.ASM_STATEMENT,
            assembly: assembly.replace(/^"(.*)"$/, '$1'), // Remove quotes
            isVolatile,
            line: this.previous().line,
            column: this.previous().column,
        };
    }
    parseExportSymbol() {
        this.consume(Lexer_1.TokenType.LEFT_PAREN, 'Expected \'(\' after EXPORT_SYMBOL');
        this.consume(Lexer_1.TokenType.IDENTIFIER, 'Expected symbol name');
        const symbol = this.previous().value;
        this.consume(Lexer_1.TokenType.RIGHT_PAREN, 'Expected \')\' after symbol name');
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after EXPORT_SYMBOL');
        return {
            type: NodeType.EXPORT_SYMBOL_STMT,
            symbol,
            line: this.previous().line,
            column: this.previous().column,
        };
    }
    parseAttribute() {
        const attribute = this.previous().value;
        // For now, we'll just consume the next function declaration
        // In a full implementation, we'd associate this with the following declaration
        this.consume(Lexer_1.TokenType.SEMICOLON, 'Expected \';\' after attribute');
        return {
            type: NodeType.ATTRIBUTE_STMT,
            attribute,
            line: this.previous().line,
            column: this.previous().column,
        };
    }
    parsePreprocessor() {
        const content = this.previous().value;
        const parts = content.split(/\s+/);
        const directive = parts[0];
        return {
            type: NodeType.PREPROCESSOR_STMT,
            directive,
            content: content.substring(1), // Remove #
            line: this.previous().line,
            column: this.previous().column,
        };
    }
}
exports.Parser = Parser;
