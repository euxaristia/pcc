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
        let targetAddr;
        if (assign.target.type === Parser_1.NodeType.IDENTIFIER) {
            const addr = this.context.valueMap.get(assign.target.name);
            if (!addr) {
                throw new Error(`Variable ${assign.target.name} not declared`);
            }
            targetAddr = addr;
        }
        else if (assign.target.type === Parser_1.NodeType.MEMBER_ACCESS) {
            // For now, treat member access like a variable
            // A full implementation would calculate the offset
            const memberAccess = assign.target;
            if (memberAccess.object.type === Parser_1.NodeType.IDENTIFIER) {
                const baseName = memberAccess.object.name;
                const addr = this.context.valueMap.get(baseName);
                if (!addr) {
                    throw new Error(`Variable ${baseName} not declared`);
                }
                targetAddr = addr;
            }
            else {
                throw new Error('Unsupported member access target');
            }
        }
        else if (assign.target.type === Parser_1.NodeType.ARRAY_ACCESS) {
            // For now, treat array access like a variable
            // A full implementation would calculate the element address
            const arrayAccess = assign.target;
            if (arrayAccess.array.type === Parser_1.NodeType.IDENTIFIER) {
                const arrayName = arrayAccess.array.name;
                const addr = this.context.valueMap.get(arrayName);
                if (!addr) {
                    throw new Error(`Variable ${arrayName} not declared`);
                }
                targetAddr = addr;
            }
            else {
                throw new Error('Unsupported array access target');
            }
        }
        else {
            throw new Error('Unsupported assignment target');
        }
        const value = this.processExpression(assign.value);
        const storeInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [value, targetAddr]);
        this.context.currentBlock.instructions.push(storeInstr);
        // Return the assigned value
        return value;
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
                return this.processAssignment(expr);
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
            case Parser_1.NodeType.SIZEOF_EXPRESSION:
                return this.processSizeofExpression(expr);
            case Parser_1.NodeType.CAST_EXPRESSION:
                return this.processCastExpression(expr);
            case Parser_1.NodeType.MEMBER_ACCESS:
                return this.processMemberAccess(expr);
            case Parser_1.NodeType.ARRAY_ACCESS:
                return this.processArrayAccess(expr);
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
        // Handle address-of (&) and dereference (*)
        if (unary.operator === '&') {
            if (unary.operand.type !== Parser_1.NodeType.IDENTIFIER) {
                throw new Error('Cannot take address of non-identifier');
            }
            const ident = unary.operand;
            const varAddr = this.context.valueMap.get(ident.name);
            if (!varAddr) {
                throw new Error(`Variable ${ident.name} not declared`);
            }
            return varAddr;
        }
        if (unary.operator === '*') {
            const ptrValue = this.processExpression(unary.operand);
            const resultType = (0, IR_1.isPointerType)(ptrValue.type) ?
                this.getPointedToType(ptrValue.type) : IR_1.IRType.I32;
            const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, resultType, [ptrValue]);
            this.context.currentBlock.instructions.push(loadInstr);
            return loadInstr;
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
                if (unary.operand.type === Parser_1.NodeType.IDENTIFIER) {
                    const ident = unary.operand;
                    const addr = this.context.valueMap.get(ident.name);
                    if (addr) {
                        const currentVal = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, addr.type, [addr]);
                        this.context.currentBlock.instructions.push(currentVal);
                        const newVal = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.ADD, addr.type, [currentVal, incrementValue]);
                        this.context.currentBlock.instructions.push(newVal);
                        const store = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.STORE, IR_1.IRType.VOID, [newVal, addr]);
                        this.context.currentBlock.instructions.push(store);
                        return currentVal;
                    }
                }
                throw new Error('Postfix increment/decrement only supported on identifiers for now');
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
        if (dataType.isPointer) {
            return IR_1.IRType.PTR;
        }
        switch (dataType.baseType) {
            case 'int': return IR_1.IRType.I32;
            case 'char': return IR_1.IRType.I8;
            case 'void': return IR_1.IRType.VOID;
            default: return IR_1.IRType.I32;
        }
    }
    parseType(typeNode) {
        let baseType;
        let structName;
        if (typeNode.typeName.startsWith('struct ')) {
            baseType = 'struct';
            structName = typeNode.typeName.substring(7);
        }
        else {
            baseType = typeNode.typeName;
        }
        return {
            baseType,
            isPointer: typeNode.isPointer,
            pointerCount: typeNode.pointerCount,
            structName,
        };
    }
    getPointedToType(ptrType) {
        // Simplified: if it's a pointer, it points to I32 for now
        // A better implementation would store the pointed-to type in IRType
        return IR_1.IRType.I32;
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
    processSizeofExpression(expr) {
        // Calculate the size based on the operand type or expression
        let size;
        if (expr.isType) {
            // sizeof(type)
            const typeNode = expr.operand;
            if (typeNode.isPointer) {
                // Pointer size on x86-64 is 8 bytes
                size = 8;
            }
            else {
                switch (typeNode.typeName) {
                    case 'int':
                        size = 4;
                        break;
                    case 'char':
                        size = 1;
                        break;
                    case 'void':
                        size = 1;
                        break;
                    default: size = 4;
                }
            }
        }
        else {
            // sizeof expression - need to get the type of the expression
            // For now, we'll just assume int (4 bytes) for expressions
            // In a full implementation, we'd analyze the expression to get its type
            const operandExpr = expr.operand;
            if (operandExpr.type === Parser_1.NodeType.IDENTIFIER) {
                // Look up the variable to get its type
                const ident = operandExpr;
                const varAddr = this.context.valueMap.get(ident.name);
                if (varAddr) {
                    // Get size based on variable's IR type
                    switch (varAddr.type) {
                        case IR_1.IRType.I8:
                            size = 1;
                            break;
                        case IR_1.IRType.I32:
                            size = 4;
                            break;
                        case IR_1.IRType.PTR:
                            size = 8;
                            break;
                        default: size = 4;
                    }
                }
                else {
                    size = 4; // Default
                }
            }
            else if (operandExpr.type === Parser_1.NodeType.NUMBER_LITERAL) {
                size = 4; // int literal
            }
            else if (operandExpr.type === Parser_1.NodeType.CHARACTER_LITERAL) {
                size = 1; // char literal
            }
            else {
                size = 4; // Default to int size
            }
        }
        return (0, IR_1.createConstant)(size, IR_1.IRType.I32);
    }
    processCastExpression(expr) {
        if (!this.context.currentBlock) {
            throw new Error('Cast expression outside block');
        }
        // First, generate the operand
        const operand = this.processExpression(expr.operand);
        // Get the target type
        const targetType = this.dataTypeToIRType(this.parseType(expr.targetType));
        // If the types are the same, no conversion needed
        if (operand.type === targetType) {
            return operand;
        }
        // For now, we just return the operand unchanged
        // A full implementation would handle:
        // - Truncation/extension between integer types (TRUNC, SEXT, ZEXT)
        // - Integer to pointer (and vice versa)
        // - Floating point conversions
        // - etc.
        //
        // For the kernel compilation, most casts are either:
        // - No-op casts (same size)
        // - Pointer casts (which are no-ops at the machine level)
        // - Truncation (handled by just using the lower bits)
        return operand;
    }
    processMemberAccess(expr) {
        if (!this.context.currentBlock) {
            throw new Error('Member access outside block');
        }
        // For now, just load from the base variable
        // A full implementation would:
        // 1. Calculate the offset of the member within the struct
        // 2. Load from base + offset
        if (expr.object.type === Parser_1.NodeType.IDENTIFIER) {
            const objectName = expr.object.name;
            const varAddr = this.context.valueMap.get(objectName);
            if (!varAddr) {
                throw new Error(`Variable ${objectName} not declared`);
            }
            // For now, just load the entire struct and pretend it's the member
            // In reality, we'd need proper struct layout
            const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, IR_1.IRType.I32, [varAddr]);
            this.context.currentBlock.instructions.push(loadInstr);
            return loadInstr;
        }
        throw new Error('Unsupported member access object type');
    }
    processArrayAccess(expr) {
        if (!this.context.currentBlock) {
            throw new Error('Array access outside block');
        }
        // For now, just load from the base variable
        // A full implementation would:
        // 1. Calculate the element address: base + (index * element_size)
        // 2. Load from that address
        if (expr.array.type === Parser_1.NodeType.IDENTIFIER) {
            const arrayName = expr.array.name;
            const varAddr = this.context.valueMap.get(arrayName);
            if (!varAddr) {
                throw new Error(`Variable ${arrayName} not declared`);
            }
            // For now, just load the first element
            // In reality, we'd need to calculate the offset based on the index
            const loadInstr = (0, IR_1.createInstruction)(this.genId(), IR_1.IROpCode.LOAD, IR_1.IRType.I32, [varAddr]);
            this.context.currentBlock.instructions.push(loadInstr);
            return loadInstr;
        }
        throw new Error('Unsupported array access type');
    }
}
exports.IRGenerator = IRGenerator;
