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
            if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) || this.check(Lexer_1.TokenType.VOID)) {
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
        return {
            type: NodeType.TYPE_SPECIFIER,
            typeName: token.value,
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
        if (this.check(Lexer_1.TokenType.INT) || this.check(Lexer_1.TokenType.CHAR) || this.check(Lexer_1.TokenType.VOID)) {
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
            if (expr.type === NodeType.IDENTIFIER) {
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
        return this.parsePostfix();
    }
    parsePostfix() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.match(Lexer_1.TokenType.LEFT_PAREN)) {
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
}
exports.Parser = Parser;
