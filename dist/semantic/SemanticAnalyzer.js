"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticAnalyzer = void 0;
const Parser_1 = require("../parser/Parser");
const SymbolTable_1 = require("./SymbolTable");
const TypeChecker_1 = require("./TypeChecker");
class SemanticAnalyzer {
    symbolTable;
    typeChecker;
    errors = [];
    currentFunction = null;
    constructor() {
        this.symbolTable = new SymbolTable_1.SymbolTable();
        this.typeChecker = new TypeChecker_1.TypeChecker();
    }
    analyze(node) {
        this.errors = [];
        this.symbolTable.enterScope(); // Global scope
        if (node.type === Parser_1.NodeType.PROGRAM) {
            this.analyzeProgram(node);
        }
        this.symbolTable.exitScope(); // Exit global scope
        return this.errors;
    }
    analyzeProgram(node) {
        // First pass: declare all functions
        for (const declaration of node.declarations) {
            if (declaration.type === Parser_1.NodeType.FUNCTION_DECLARATION) {
                this.declareFunction(declaration);
            }
        }
        // Second pass: analyze all declarations
        for (const declaration of node.declarations) {
            if (declaration.type === Parser_1.NodeType.FUNCTION_DECLARATION) {
                this.analyzeFunctionDeclaration(declaration);
            }
            else if (declaration.type === Parser_1.NodeType.DECLARATION) {
                this.analyzeVariableDeclaration(declaration);
            }
        }
    }
    declareFunction(node) {
        const returnType = this.parseDataType(node.returnType);
        const parameterTypes = [];
        for (const param of node.parameters) {
            const paramType = this.parseDataType(param.varType);
            parameterTypes.push({ name: param.name, type: paramType });
        }
        const symbol = {
            name: node.name,
            type: returnType,
            kind: 'function',
            scopeLevel: this.symbolTable.getCurrentScopeLevel(),
            line: node.line,
            column: node.column,
            returnType,
            parameters: parameterTypes,
        };
        try {
            this.symbolTable.declare(symbol);
            this.typeChecker.declareFunction({
                name: node.name,
                returnType,
                parameterTypes: parameterTypes.map(p => p.type),
            });
        }
        catch (error) {
            this.errors.push({
                message: error.message,
                line: node.line,
                column: node.column,
                node,
            });
        }
    }
    analyzeFunctionDeclaration(node) {
        this.currentFunction = node;
        this.symbolTable.enterScope(); // Function scope
        // Declare parameters
        for (const param of node.parameters) {
            const paramType = this.parseDataType(param.varType);
            const symbol = {
                name: param.name,
                type: paramType,
                kind: 'parameter',
                scopeLevel: this.symbolTable.getCurrentScopeLevel(),
                line: param.line,
                column: param.column,
            };
            try {
                this.symbolTable.declare(symbol);
            }
            catch (error) {
                this.errors.push({
                    message: error.message,
                    line: param.line,
                    column: param.column,
                    node: param,
                });
            }
        }
        // Analyze function body
        this.analyzeCompoundStatement(node.body);
        this.symbolTable.exitScope(); // Exit function scope
        this.currentFunction = null;
    }
    analyzeVariableDeclaration(node) {
        const varType = this.parseDataType(node.varType);
        const symbol = {
            name: node.name,
            type: varType,
            kind: 'variable',
            scopeLevel: this.symbolTable.getCurrentScopeLevel(),
            line: node.line,
            column: node.column,
        };
        try {
            this.symbolTable.declare(symbol);
        }
        catch (error) {
            this.errors.push({
                message: error.message,
                line: node.line,
                column: node.column,
                node,
            });
        }
        // Analyze initializer if present
        if (node.initializer) {
            const result = this.analyzeExpression(node.initializer);
            if (!result.isError && result.type !== varType) {
                this.errors.push({
                    message: `Cannot initialize ${varType} variable '${node.name}' with value of type ${result.type}`,
                    line: node.line,
                    column: node.column,
                    node,
                });
            }
            if (result.errorMessage) {
                this.errors.push({
                    message: result.errorMessage,
                    line: node.line,
                    column: node.column,
                    node: node.initializer,
                });
            }
        }
    }
    analyzeCompoundStatement(node) {
        this.symbolTable.enterScope(); // Block scope
        for (const statement of node.statements) {
            this.analyzeStatement(statement);
        }
        this.symbolTable.exitScope(); // Exit block scope
    }
    analyzeStatement(node) {
        switch (node.type) {
            case Parser_1.NodeType.DECLARATION:
                this.analyzeVariableDeclaration(node);
                break;
            case Parser_1.NodeType.ASSIGNMENT:
                this.analyzeAssignmentStatement(node);
                break;
            case Parser_1.NodeType.IF_STATEMENT:
                this.analyzeIfStatement(node);
                break;
            case Parser_1.NodeType.WHILE_STATEMENT:
                this.analyzeWhileStatement(node);
                break;
            case Parser_1.NodeType.FOR_STATEMENT:
                this.analyzeForStatement(node);
                break;
            case Parser_1.NodeType.RETURN_STATEMENT:
                this.analyzeReturnStatement(node);
                break;
            case Parser_1.NodeType.EXPRESSION_STATEMENT:
                this.analyzeExpressionStatement(node);
                break;
            case Parser_1.NodeType.COMPOUND_STATEMENT:
                this.analyzeCompoundStatement(node);
                break;
        }
    }
    analyzeAssignmentStatement(node) {
        // Just delegate to the expression analyzer to avoid duplicate error reporting
        this.analyzeExpression(node);
    }
    analyzeIfStatement(node) {
        const conditionResult = this.analyzeExpression(node.condition);
        if (conditionResult.errorMessage) {
            this.errors.push({
                message: `Invalid if condition: ${conditionResult.errorMessage}`,
                line: node.line,
                column: node.column,
                node: node.condition,
            });
        }
        this.analyzeStatement(node.thenBranch);
        if (node.elseBranch) {
            this.analyzeStatement(node.elseBranch);
        }
    }
    analyzeWhileStatement(node) {
        const conditionResult = this.analyzeExpression(node.condition);
        if (conditionResult.errorMessage) {
            this.errors.push({
                message: `Invalid while condition: ${conditionResult.errorMessage}`,
                line: node.line,
                column: node.column,
                node: node.condition,
            });
        }
        this.analyzeStatement(node.body);
    }
    analyzeForStatement(node) {
        // Analyze initialization
        if (node.initialization) {
            if (node.initialization.type === Parser_1.NodeType.DECLARATION) {
                this.analyzeVariableDeclaration(node.initialization);
            }
            else {
                this.analyzeExpressionStatement(node.initialization);
            }
        }
        // Analyze condition
        if (node.condition) {
            const conditionResult = this.analyzeExpression(node.condition);
            if (conditionResult.errorMessage) {
                this.errors.push({
                    message: `Invalid for condition: ${conditionResult.errorMessage}`,
                    line: node.line,
                    column: node.column,
                    node: node.condition,
                });
            }
        }
        // Analyze increment
        if (node.increment) {
            const result = this.analyzeExpression(node.increment);
            if (result.errorMessage) {
                this.errors.push({
                    message: `Invalid for increment: ${result.errorMessage}`,
                    line: node.line,
                    column: node.column,
                    node: node.increment,
                });
            }
        }
        this.analyzeStatement(node.body);
    }
    analyzeReturnStatement(node) {
        if (!this.currentFunction) {
            this.errors.push({
                message: 'Return statement outside of function',
                line: node.line,
                column: node.column,
                node,
            });
            return;
        }
        const expectedType = this.parseDataType(this.currentFunction.returnType);
        if (node.value) {
            const result = this.analyzeExpression(node.value);
            if (result.isError) {
                this.errors.push({
                    message: `Invalid return value: ${result.errorMessage}`,
                    line: node.line,
                    column: node.column,
                    node: node.value,
                });
            }
            else if (!this.typeChecker.isValidReturnType(expectedType, result.type)) {
                this.errors.push({
                    message: `Function '${this.currentFunction.name}' expects to return ${expectedType}, but got ${result.type}`,
                    line: node.line,
                    column: node.column,
                    node,
                });
            }
        }
        else {
            if (expectedType !== SymbolTable_1.DataType.VOID) {
                this.errors.push({
                    message: `Function '${this.currentFunction.name}' expects to return ${expectedType}, but got no value`,
                    line: node.line,
                    column: node.column,
                    node,
                });
            }
        }
    }
    analyzeExpressionStatement(node) {
        this.analyzeExpression(node.expression);
        // Don't add duplicate errors - the expression analyzer already adds them
    }
    analyzeExpression(node) {
        switch (node.type) {
            case Parser_1.NodeType.ASSIGNMENT:
                return this.analyzeAssignmentExpression(node);
            case Parser_1.NodeType.BINARY_EXPRESSION:
                return this.analyzeBinaryExpression(node);
            case Parser_1.NodeType.UNARY_EXPRESSION:
                return this.analyzeUnaryExpression(node);
            case Parser_1.NodeType.FUNCTION_CALL:
                return this.analyzeFunctionCall(node);
            case Parser_1.NodeType.IDENTIFIER:
                return this.analyzeIdentifier(node);
            case Parser_1.NodeType.NUMBER_LITERAL:
                return { type: SymbolTable_1.DataType.INT, isError: false };
            case Parser_1.NodeType.STRING_LITERAL:
                this.errors.push({
                    message: 'String literals not yet supported',
                    line: node.line,
                    column: node.column,
                    node,
                });
                return { type: SymbolTable_1.DataType.VOID, isError: true, errorMessage: 'String literals not yet supported' };
            case Parser_1.NodeType.CHARACTER_LITERAL:
                return { type: SymbolTable_1.DataType.CHAR, isError: false };
            default:
                return { type: SymbolTable_1.DataType.VOID, isError: true, errorMessage: 'Unknown expression type' };
        }
    }
    analyzeBinaryExpression(node) {
        const leftResult = this.analyzeExpression(node.left);
        const rightResult = this.analyzeExpression(node.right);
        if (leftResult.isError) {
            return leftResult;
        }
        if (rightResult.isError) {
            return rightResult;
        }
        return this.typeChecker.checkCompatible(leftResult.type, rightResult.type, node.operator);
    }
    analyzeAssignmentExpression(node) {
        const targetResult = this.analyzeExpression(node.target);
        const valueResult = this.analyzeExpression(node.value);
        if (targetResult.isError) {
            return targetResult;
        }
        if (valueResult.isError) {
            return valueResult;
        }
        const result = this.typeChecker.checkCompatible(targetResult.type, valueResult.type, '=');
        if (result.isError) {
            this.errors.push({
                message: result.errorMessage,
                line: node.line,
                column: node.column,
                node,
            });
        }
        return { type: targetResult.type, isError: result.isError, errorMessage: result.errorMessage };
    }
    analyzeUnaryExpression(node) {
        const operandResult = this.analyzeExpression(node.operand);
        if (operandResult.isError) {
            return operandResult;
        }
        // Handle different unary operators
        if (node.operator === '!') {
            return { type: SymbolTable_1.DataType.INT, isError: false };
        }
        if (node.operator === '-' || node.operator === '++_post' || node.operator === '--_post' || node.operator === '++' || node.operator === '--') {
            if (operandResult.type === SymbolTable_1.DataType.INT) {
                return { type: SymbolTable_1.DataType.INT, isError: false };
            }
            return {
                type: SymbolTable_1.DataType.INT,
                isError: true,
                errorMessage: `Unary operator '${node.operator}' cannot be applied to ${operandResult.type}`,
            };
        }
        // Pointer operators (&, *)
        if (node.operator === '&' || node.operator === '*') {
            this.errors.push({
                message: `Pointer operators '${node.operator}' not yet supported`,
                line: node.line,
                column: node.column,
                node,
            });
            return { type: SymbolTable_1.DataType.VOID, isError: true, errorMessage: 'Pointer operators not yet supported' };
        }
        return { type: operandResult.type, isError: false };
    }
    analyzeFunctionCall(node) {
        const argTypes = [];
        const argErrors = [];
        for (const arg of node.arguments) {
            const result = this.analyzeExpression(arg);
            if (result.isError) {
                argErrors.push({
                    message: result.errorMessage,
                    line: arg.line,
                    column: arg.column,
                    node: arg,
                });
            }
            else {
                argTypes.push(result.type);
            }
        }
        const callResult = this.typeChecker.checkFunctionCall(node.name, argTypes);
        // Add argument errors to main error list
        this.errors.push(...argErrors);
        return callResult;
    }
    analyzeIdentifier(node) {
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            return {
                type: SymbolTable_1.DataType.VOID,
                isError: true,
                errorMessage: `Undeclared identifier '${node.name}'`,
            };
        }
        return { type: symbol.type, isError: false };
    }
    parseDataType(typeNode) {
        switch (typeNode.typeName) {
            case 'int':
                return SymbolTable_1.DataType.INT;
            case 'char':
                return SymbolTable_1.DataType.CHAR;
            case 'void':
                return SymbolTable_1.DataType.VOID;
            default:
                return SymbolTable_1.DataType.VOID;
        }
    }
}
exports.SemanticAnalyzer = SemanticAnalyzer;
//# sourceMappingURL=SemanticAnalyzer.js.map