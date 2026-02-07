import { ASTNode } from '../parser/Parser';
export interface SemanticError {
    message: string;
    line?: number;
    column?: number;
    node?: ASTNode;
}
export declare class SemanticAnalyzer {
    private symbolTable;
    private typeChecker;
    private errors;
    private currentFunction;
    constructor();
    analyze(node: ASTNode): SemanticError[];
    private analyzeProgram;
    private declareFunction;
    private analyzeFunctionDeclaration;
    private analyzeVariableDeclaration;
    private analyzeCompoundStatement;
    private analyzeStatement;
    private analyzeAssignmentStatement;
    private analyzeIfStatement;
    private analyzeWhileStatement;
    private analyzeForStatement;
    private analyzeReturnStatement;
    private analyzeExpressionStatement;
    private analyzeExpression;
    private analyzeBinaryExpression;
    private analyzeAssignmentExpression;
    private analyzeUnaryExpression;
    private analyzeFunctionCall;
    private analyzeIdentifier;
    private parseDataType;
}
//# sourceMappingURL=SemanticAnalyzer.d.ts.map