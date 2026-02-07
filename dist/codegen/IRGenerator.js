"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IRGenerator = void 0;
const Parser_1 = require("../parser/Parser");
const IR_1 = require("./IR");
class IRGenerator {
    constructor() {
        this.context = {
            currentFunction: null,
            currentBlock: null,
            nextId: 0,
            labelCounter: 0,
            valueMap: new Map(),
        };
        this.module = { functions: [], globals: [] };
    }
    generate(program) {
        this.module = { functions: [], globals: [] };
        // First pass: process global variable declarations
        for (const decl of program.declarations) {
            if (decl.type === Parser_1.NodeType.DECLARATION) {
                this.processGlobalDeclaration(decl);
            }
        }
        // Second pass: process function declarations
        for (const decl of program.declarations) {
            if (decl.type === Parser_1.NodeType.FUNCTION_DECLARATION) {
                this.processFunctionDeclaration(decl);
            }
        }
        return this.module;
    }
    processGlobalDeclaration(decl) {
        const irType = this.dataTypeToIRType(this.parseType(decl.varType));
        let initializer;
        if (decl.initializer && decl.initializer.type === Parser_1.NodeType.NUMBER_LITERAL) {
            const literal = decl.initializer;
            initializer = (0, IR_1.createConstant)(parseInt(literal.value), irType);
        }
        this.module.globals.push({
            name: decl.name,
            type: irType,
            initializer,
        });
    }
    processFunctionDeclaration(funcDecl) {
        const returnType = this.dataTypeToIRType(this.parseType(funcDecl.returnType));
        const parameters = funcDecl.parameters.map(param => ({
            name: param.name,
            type: this.dataTypeToIRType(this.parseType(param.varType)),
        }));
        const irFunction = {
            name: funcDecl.name,
            returnType,
            parameters,
            body: [],
            locals: [],
        };
        this.context.currentFunction = irFunction;
        this.context.valueMap.clear();
        // Create entry block
        const entryBlock = this.createNewBlock('entry');
        irFunction.body.push(entryBlock);
        this.context.currentBlock = entryBlock;
        // Store parameters to local stack
        for (const param of parameters) {
            const paramValue = (0, IR_1.createValue)(param.name, param.type);
            const allocaInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.ALLOCA, param.type, []);
            entryBlock.instructions.push(allocaInstr);
            const storeInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [paramValue, (0, IR_1.createValue)(this.genId(), param.type)] // Use temporary value for parameter
            );
            entryBlock.instructions.push(storeInstr);
            this.context.valueMap.set(param.name, allocaInstr);
        }
        // Process function body
        this.processStatement(funcDecl.body);
        this.module.functions.push(irFunction);
        this.context.currentFunction = null;
    }
    processStatement(stmt) {
        switch (stmt.type) {
            case Parser_1.NodeType.DECLARATION:
                this.processVariableDeclaration(stmt);
                break;
            case Parser_1.NodeType.ASSIGNMENT:
                this.processAssignment(stmt);
                break;
            case Parser_1.NodeType.IF_STATEMENT:
                this.processIfStatement(stmt);
                break;
            case Parser_1.NodeType.WHILE_STATEMENT:
                this.processWhileStatement(stmt);
                break;
            case Parser_1.NodeType.FOR_STATEMENT:
                this.processForStatement(stmt);
                break;
            case Parser_1.NodeType.RETURN_STATEMENT:
                this.processReturnStatement(stmt);
                break;
            case Parser_1.NodeType.EXPRESSION_STATEMENT:
                this.processExpressionStatement(stmt);
                break;
            case Parser_1.NodeType.COMPOUND_STATEMENT:
                this.processCompoundStatement(stmt);
                break;
        }
    }
    processVariableDeclaration(decl) {
        if (!this.context.currentFunction || !this.context.currentBlock) {
            throw new Error('Variable declaration outside function');
        }
        const varType = this.dataTypeToIRType(this.parseType(decl.varType));
        // Allocate space on stack
        const allocaInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.ALLOCA, varType, []);
        this.context.currentBlock.instructions.push(allocaInstr);
        // Store in symbol table
        this.context.valueMap.set(decl.name, allocaInstr);
        // Initialize if needed
        if (decl.initializer) {
            const initValue = this.processExpression(decl.initializer);
            const storeInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [initValue, allocaInstr]);
            this.context.currentBlock.instructions.push(storeInstr);
        }
        // Track local variable
        if (this.context.currentFunction) {
            this.context.currentFunction.locals.push({
                name: decl.name,
                type: varType,
            });
        }
    }
    processAssignment(assign) {
        if (!this.context.currentBlock) {
            throw new Error('Assignment outside block');
        }
        const targetAddr = this.context.valueMap.get(assign.target.name);
        if (!targetAddr) {
            throw new Error(`Variable ${assign.target.name} not declared`);
        }
        const value = this.processExpression(assign.value);
        const storeInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [value, targetAddr]);
        this.context.currentBlock.instructions.push(storeInstr);
    }
    processIfStatement(ifStmt) {
        if (!this.context.currentFunction || !this.context.currentBlock) {
            throw new Error('If statement outside function');
        }
        const condition = this.processExpression(ifStmt.condition);
        const thenBlock = this.createNewBlock('then');
        const elseBlock = ifStmt.elseBranch ? this.createNewBlock('else') : null;
        const mergeBlock = this.createNewBlock('merge');
        // Conditional jump
        const jumpIfInstr = {
            condition: condition,
            trueTarget: thenBlock.label,
            falseTarget: elseBlock ? elseBlock.label : mergeBlock.label,
        };
        this.context.currentBlock.instructions.push(jumpIfInstr);
        // Process then branch
        this.context.currentFunction.body.push(thenBlock);
        this.context.currentBlock = thenBlock;
        this.processStatement(ifStmt.thenBranch);
        if (this.context.currentBlock) {
            this.context.currentBlock.instructions.push({ target: mergeBlock.label });
        }
        // Process else branch if present
        if (elseBlock && ifStmt.elseBranch) {
            this.context.currentFunction.body.push(elseBlock);
            this.context.currentBlock = elseBlock;
            this.processStatement(ifStmt.elseBranch);
            if (this.context.currentBlock) {
                this.context.currentBlock.instructions.push({ target: mergeBlock.label });
            }
        }
        // Continue in merge block
        this.context.currentFunction.body.push(mergeBlock);
        this.context.currentBlock = mergeBlock;
    }
    processWhileStatement(whileStmt) {
        if (!this.context.currentFunction || !this.context.currentBlock) {
            throw new Error('While statement outside function');
        }
        const condBlock = this.createNewBlock('while.cond');
        const bodyBlock = this.createNewBlock('while.body');
        const afterBlock = this.createNewBlock('while.after');
        // Jump to condition
        this.context.currentBlock.instructions.push({ target: condBlock.label });
        // Condition block
        this.context.currentFunction.body.push(condBlock);
        this.context.currentBlock = condBlock;
        const condition = this.processExpression(whileStmt.condition);
        const jumpIfInstr = {
            condition: condition,
            trueTarget: bodyBlock.label,
            falseTarget: afterBlock.label,
        };
        this.context.currentBlock.instructions.push(jumpIfInstr);
        // Body block
        this.context.currentFunction.body.push(bodyBlock);
        this.context.currentBlock = bodyBlock;
        this.processStatement(whileStmt.body);
        if (this.context.currentBlock) {
            this.context.currentBlock.instructions.push({ target: condBlock.label });
        }
        // After block
        this.context.currentFunction.body.push(afterBlock);
        this.context.currentBlock = afterBlock;
    }
    processForStatement(forStmt) {
        if (!this.context.currentFunction || !this.context.currentBlock) {
            throw new Error('For statement outside function');
        }
        const condBlock = this.createNewBlock('for.cond');
        const bodyBlock = this.createNewBlock('for.body');
        const incBlock = this.createNewBlock('for.inc');
        const afterBlock = this.createNewBlock('for.after');
        // Process initialization
        if (forStmt.initialization) {
            if (forStmt.initialization.type === Parser_1.NodeType.DECLARATION) {
                this.processVariableDeclaration(forStmt.initialization);
            }
            else {
                this.processExpressionStatement(forStmt.initialization);
            }
        }
        // Jump to condition
        this.context.currentBlock.instructions.push({ target: condBlock.label });
        // Condition block
        this.context.currentFunction.body.push(condBlock);
        this.context.currentBlock = condBlock;
        let condition;
        if (forStmt.condition) {
            condition = this.processExpression(forStmt.condition);
        }
        else {
            condition = (0, IR_1.createConstant)(1, IR_1.IRType.I32); // Always true
        }
        const jumpIfInstr = {
            condition: condition,
            trueTarget: bodyBlock.label,
            falseTarget: afterBlock.label,
        };
        this.context.currentBlock.instructions.push(jumpIfInstr);
        // Body block
        this.context.currentFunction.body.push(bodyBlock);
        this.context.currentBlock = bodyBlock;
        this.processStatement(forStmt.body);
        if (this.context.currentBlock) {
            this.context.currentBlock.instructions.push({ target: incBlock.label });
        }
        // Increment block
        this.context.currentFunction.body.push(incBlock);
        this.context.currentBlock = incBlock;
        if (forStmt.increment) {
            this.processExpression(forStmt.increment);
        }
        this.context.currentBlock.instructions.push({ target: condBlock.label });
        // After block
        this.context.currentFunction.body.push(afterBlock);
        this.context.currentBlock = afterBlock;
    }
    processReturnStatement(retStmt) {
        if (!this.context.currentBlock) {
            throw new Error('Return statement outside block');
        }
        let value;
        if (retStmt.value) {
            value = this.processExpression(retStmt.value);
        }
        const retInstr = {
            value,
            type: value ? value.type || IR_1.IRType.I32 : IR_1.IRType.VOID,
        };
        this.context.currentBlock.instructions.push(retInstr);
    }
    processExpressionStatement(exprStmt) {
        this.processExpression(exprStmt.expression);
    }
    processCompoundStatement(compound) {
        for (const stmt of compound.statements) {
            if (this.context.currentBlock) { // Check if we haven't hit a return
                this.processStatement(stmt);
            }
        }
    }
    processExpression(expr) {
        switch (expr.type) {
            case Parser_1.NodeType.ASSIGNMENT:
                this.processAssignment(expr);
                // Return the assigned value
                const target = this.context.valueMap.get(expr.target.name);
                if (!target) {
                    throw new Error(`Variable ${expr.target.name} not declared`);
                }
                if (!this.context.currentBlock) {
                    throw new Error('Assignment outside block');
                }
                const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, target.type, [target]);
                this.context.currentBlock.instructions.push(loadInstr);
                return loadInstr;
            case Parser_1.NodeType.BINARY_EXPRESSION:
                return this.processBinaryExpression(expr);
            case Parser_1.NodeType.UNARY_EXPRESSION:
                return this.processUnaryExpression(expr);
            case Parser_1.NodeType.FUNCTION_CALL:
                return this.processFunctionCall(expr);
            case Parser_1.NodeType.IDENTIFIER:
                return this.processIdentifier(expr);
            case Parser_1.NodeType.NUMBER_LITERAL:
                return this.processNumberLiteral(expr);
            case Parser_1.NodeType.CHARACTER_LITERAL:
                return this.processCharacterLiteral(expr);
            default:
                throw new Error(`Unsupported expression type: ${expr.type}`);
        }
    }
    processBinaryExpression(binary) {
        if (!this.context.currentBlock) {
            throw new Error('Binary expression outside block');
        }
        const left = this.processExpression(binary.left);
        const right = this.processExpression(binary.right);
        let opcode;
        switch (binary.operator) {
            case '+':
                opcode = IR_1.IROpCode.ADD;
                break;
            case '-':
                opcode = IR_1.IROpCode.SUB;
                break;
            case '*':
                opcode = IR_1.IROpCode.MUL;
                break;
            case '/':
                opcode = IR_1.IROpCode.DIV;
                break;
            case '%':
                opcode = IR_1.IROpCode.MOD;
                break;
            case '==':
                opcode = IR_1.IROpCode.EQ;
                break;
            case '!=':
                opcode = IR_1.IROpCode.NE;
                break;
            case '<':
                opcode = IR_1.IROpCode.LT;
                break;
            case '<=':
                opcode = IR_1.IROpCode.LE;
                break;
            case '>':
                opcode = IR_1.IROpCode.GT;
                break;
            case '>=':
                opcode = IR_1.IROpCode.GE;
                break;
            case '&&':
                opcode = IR_1.IROpCode.AND;
                break;
            case '||':
                opcode = IR_1.IROpCode.OR;
                break;
            default:
                throw new Error(`Unsupported binary operator: ${binary.operator}`);
        }
        const resultType = this.getOperationResultType(opcode, left, right);
        const result = (0, IR_1.createInstruction)(this.genId(), opcode, resultType, [left, right]);
        this.context.currentBlock.instructions.push(result);
        return result;
    }
    processUnaryExpression(unary) {
        if (!this.context.currentBlock) {
            throw new Error('Unary expression outside block');
        }
        const operand = this.processExpression(unary.operand);
        let opcode;
        switch (unary.operator) {
            case '-':
                opcode = IR_1.IROpCode.SUB;
                break;
            case '!':
                opcode = IR_1.IROpCode.NOT;
                break;
            case '++_post':
            case '--_post':
                // Handle post-increment/decrement: load value, compute new value, store back
                const incrementValue = unary.operator === '++_post' ?
                    (0, IR_1.createConstant)(1, IR_1.IRType.I32) : (0, IR_1.createConstant)(-1, IR_1.IRType.I32);
                const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, operand.type, [operand]);
                this.context.currentBlock.instructions.push(loadInstr);
                const addInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.ADD, operand.type, [loadInstr, incrementValue]);
                this.context.currentBlock.instructions.push(addInstr);
                const storeInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [addInstr, operand]);
                this.context.currentBlock.instructions.push(storeInstr);
                return loadInstr; // Return original value for post-increment
            default:
                throw new Error(`Unsupported unary operator: ${unary.operator}`);
        }
        if (unary.operator === '-') {
            const zero = (0, IR_1.createConstant)(0, operand.type);
            const result = (0, IR_1.createInstruction)(this.genId(), opcode, operand.type, [zero, operand]);
            this.context.currentBlock.instructions.push(result);
            return result;
        }
        else {
            const result = (0, IR_1.createInstruction)(this.genId(), opcode, IR_1.IRType.I32, [operand]);
            this.context.currentBlock.instructions.push(result);
            return result;
        }
    }
    processFunctionCall(call) {
        if (!this.context.currentBlock) {
            throw new Error('Function call outside block');
        }
        const args = call.arguments.map(arg => this.processExpression(arg));
        const callInstr = {
            callee: call.name,
            args,
            type: IR_1.IRType.I32, // Default for now
        };
        this.context.currentBlock.instructions.push(callInstr);
        // Return a temporary value representing the call result
        return (0, IR_1.createValue)(this.genId(), callInstr.type);
    }
    processIdentifier(ident) {
        // Check if it's a global variable
        const global = this.module.globals.find(g => g.name === ident.name);
        if (global) {
            // For global variables, create a load instruction
            if (!this.context.currentBlock) {
                throw new Error('Identifier access outside block');
            }
            const globalValue = (0, IR_1.createValue)(ident.name, global.type);
            const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, global.type, [globalValue]);
            this.context.currentBlock.instructions.push(loadInstr);
            return loadInstr;
        }
        // Check local variables
        const varAddr = this.context.valueMap.get(ident.name);
        if (!varAddr) {
            throw new Error(`Variable ${ident.name} not declared`);
        }
        if (!this.context.currentBlock) {
            throw new Error('Identifier access outside block');
        }
        const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, varAddr.type, [varAddr]);
        this.context.currentBlock.instructions.push(loadInstr);
        return loadInstr;
    }
    processNumberLiteral(literal) {
        const value = parseInt(literal.value);
        return (0, IR_1.createConstant)(value, IR_1.IRType.I32);
    }
    processCharacterLiteral(literal) {
        const value = literal.value.charCodeAt(1); // Skip the opening quote
        return (0, IR_1.createConstant)(value, IR_1.IRType.I8);
    }
    dataTypeToIRType(dataType) {
        switch (dataType) {
            case 'int': return IR_1.IRType.I32;
            case 'char': return IR_1.IRType.I8;
            case 'void': return IR_1.IRType.VOID;
            default: return IR_1.IRType.I32;
        }
    }
    parseType(typeNode) {
        return typeNode.typeName;
    }
    getOperationResultType(opcode, left, right) {
        // For now, assume all operations return I32
        return IR_1.IRType.I32;
    }
    createNewBlock(prefix) {
        return {
            label: `${prefix}_${this.context.labelCounter++}`,
            instructions: [],
        };
    }
    genId() {
        return `t${this.context.nextId++}`;
    }
}
exports.IRGenerator = IRGenerator;
