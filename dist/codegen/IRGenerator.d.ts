import { ProgramNode } from '../parser/Parser';
import { IRModule } from './IR';
export declare class IRGenerator {
    private context;
    private module;
    constructor();
    generate(program: ProgramNode): IRModule;
    private processGlobalDeclaration;
    private processFunctionDeclaration;
    private processStatement;
    private processVariableDeclaration;
    private processAssignment;
    private processIfStatement;
    private processWhileStatement;
    private processForStatement;
    private processReturnStatement;
    private processExpressionStatement;
    private processCompoundStatement;
    private processExpression;
    private processBinaryExpression;
    private processUnaryExpression;
    private processFunctionCall;
    private processIdentifier;
    private processNumberLiteral;
    private processCharacterLiteral;
    private dataTypeToIRType;
    private parseType;
    private getOperationResultType;
    private createNewBlock;
    private genId;
}
//# sourceMappingURL=IRGenerator.d.ts.map