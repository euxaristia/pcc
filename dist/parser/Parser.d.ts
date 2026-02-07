import { Token } from '../lexer/Lexer';
export declare enum NodeType {
    PROGRAM = "PROGRAM",
    FUNCTION_DECLARATION = "FUNCTION_DECLARATION",
    PARAMETER_LIST = "PARAMETER_LIST",
    PARAMETER = "PARAMETER",
    COMPOUND_STATEMENT = "COMPOUND_STATEMENT",
    DECLARATION = "DECLARATION",
    ASSIGNMENT = "ASSIGNMENT",
    IF_STATEMENT = "IF_STATEMENT",
    WHILE_STATEMENT = "WHILE_STATEMENT",
    FOR_STATEMENT = "FOR_STATEMENT",
    RETURN_STATEMENT = "RETURN_STATEMENT",
    EXPRESSION_STATEMENT = "EXPRESSION_STATEMENT",
    BINARY_EXPRESSION = "BINARY_EXPRESSION",
    UNARY_EXPRESSION = "UNARY_EXPRESSION",
    FUNCTION_CALL = "FUNCTION_CALL",
    ARGUMENT_LIST = "ARGUMENT_LIST",
    IDENTIFIER = "IDENTIFIER",
    NUMBER_LITERAL = "NUMBER_LITERAL",
    STRING_LITERAL = "STRING_LITERAL",
    CHARACTER_LITERAL = "CHARACTER_LITERAL",
    TYPE_SPECIFIER = "TYPE_SPECIFIER"
}
export interface ASTNode {
    type: NodeType;
    line?: number;
    column?: number;
}
export interface ProgramNode extends ASTNode {
    type: NodeType.PROGRAM;
    declarations: (FunctionDeclarationNode | DeclarationNode)[];
}
export interface FunctionDeclarationNode extends ASTNode {
    type: NodeType.FUNCTION_DECLARATION;
    returnType: TypeSpecifierNode;
    name: string;
    parameters: ParameterNode[];
    body: CompoundStatementNode;
}
export interface ParameterNode extends ASTNode {
    type: NodeType.PARAMETER;
    varType: TypeSpecifierNode;
    name: string;
}
export interface TypeSpecifierNode extends ASTNode {
    type: NodeType.TYPE_SPECIFIER;
    typeName: string;
}
export interface CompoundStatementNode extends ASTNode {
    type: NodeType.COMPOUND_STATEMENT;
    statements: ASTNode[];
}
export interface DeclarationNode extends ASTNode {
    type: NodeType.DECLARATION;
    varType: TypeSpecifierNode;
    name: string;
    initializer?: ExpressionNode;
}
export interface AssignmentNode extends ASTNode {
    type: NodeType.ASSIGNMENT;
    target: IdentifierNode;
    value: ExpressionNode;
}
export interface IfStatementNode extends ASTNode {
    type: NodeType.IF_STATEMENT;
    condition: ExpressionNode;
    thenBranch: ASTNode;
    elseBranch?: ASTNode;
}
export interface WhileStatementNode extends ASTNode {
    type: NodeType.WHILE_STATEMENT;
    condition: ExpressionNode;
    body: ASTNode;
}
export interface ForStatementNode extends ASTNode {
    type: NodeType.FOR_STATEMENT;
    initialization?: DeclarationNode | ExpressionStatementNode;
    condition?: ExpressionNode;
    increment?: ExpressionNode;
    body: ASTNode;
}
export interface ReturnStatementNode extends ASTNode {
    type: NodeType.RETURN_STATEMENT;
    value?: ExpressionNode;
}
export interface ExpressionStatementNode extends ASTNode {
    type: NodeType.EXPRESSION_STATEMENT;
    expression: ExpressionNode;
}
export interface BinaryExpressionNode extends ASTNode {
    type: NodeType.BINARY_EXPRESSION;
    operator: string;
    left: ExpressionNode;
    right: ExpressionNode;
}
export interface UnaryExpressionNode extends ASTNode {
    type: NodeType.UNARY_EXPRESSION;
    operator: string;
    operand: ExpressionNode;
}
export interface FunctionCallNode extends ASTNode {
    type: NodeType.FUNCTION_CALL;
    name: string;
    arguments: ExpressionNode[];
}
export interface IdentifierNode extends ASTNode {
    type: NodeType.IDENTIFIER;
    name: string;
}
export interface NumberLiteralNode extends ASTNode {
    type: NodeType.NUMBER_LITERAL;
    value: string;
}
export interface StringLiteralNode extends ASTNode {
    type: NodeType.STRING_LITERAL;
    value: string;
}
export interface CharacterLiteralNode extends ASTNode {
    type: NodeType.CHARACTER_LITERAL;
    value: string;
}
export type ExpressionNode = BinaryExpressionNode | UnaryExpressionNode | FunctionCallNode | AssignmentNode | IdentifierNode | NumberLiteralNode | StringLiteralNode | CharacterLiteralNode;
export type StatementNode = DeclarationNode | AssignmentNode | IfStatementNode | WhileStatementNode | ForStatementNode | ReturnStatementNode | ExpressionStatementNode | CompoundStatementNode;
export declare class Parser {
    private tokens;
    private current;
    constructor(tokens: Token[]);
    private peek;
    private previous;
    private isAtEnd;
    private advance;
    private check;
    private match;
    private consume;
    private error;
    parse(): ProgramNode;
    private parseDeclaration;
    private parseTypeSpecifier;
    private parseFunctionDeclaration;
    private parseParameters;
    private parseVariableDeclaration;
    private parseCompoundStatement;
    private parseStatement;
    private parseIfStatement;
    private parseWhileStatement;
    private parseForStatement;
    private parseReturnStatement;
    private parseExpressionStatement;
    private parseExpression;
    private parseAssignment;
    private parseLogicalOr;
    private parseLogicalAnd;
    private parseEquality;
    private parseRelational;
    private parseShift;
    private parseAdditive;
    private parseMultiplicative;
    private parseUnary;
    private parsePostfix;
    private parsePrimary;
}
//# sourceMappingURL=Parser.d.ts.map