import {
  ProgramNode, FunctionDeclarationNode, DeclarationNode, AssignmentNode,
  IfStatementNode, WhileStatementNode, ForStatementNode, ReturnStatementNode,
  ExpressionStatementNode, BinaryExpressionNode, UnaryExpressionNode,
  FunctionCallNode, IdentifierNode, NumberLiteralNode, StringLiteralNode,
  CharacterLiteralNode, NodeType, ExpressionNode, StatementNode, TypeSpecifierNode
} from '../parser/Parser';
import { DataType } from '../semantic/SymbolTable';
import {
  IRModule, IRFunction, IRBlock, IRInstruction, IRValue, IRConstant,
  IRJump, IRJumpIf, IRCall, IRRet, IROpCode, IRType, IRLabel,
  createValue, createConstant, createInstruction, isPointerType
} from './IR';

interface IRGenerationContext {
  currentFunction: IRFunction | null;
  currentBlock: IRBlock | null;
  nextId: number;
  labelCounter: number;
  valueMap: Map<string, IRValue>; // Maps variable names to their stack locations
}

export class IRGenerator {
  private context: IRGenerationContext;
  private module: IRModule;

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

  generate(program: ProgramNode): IRModule {
    this.module = { functions: [], globals: [] };
    
    // First pass: process global variable declarations
    for (const decl of program.declarations) {
      if (decl.type === NodeType.DECLARATION) {
        this.processGlobalDeclaration(decl as DeclarationNode);
      }
    }

    // Second pass: process function declarations
    for (const decl of program.declarations) {
      if (decl.type === NodeType.FUNCTION_DECLARATION) {
        this.processFunctionDeclaration(decl as FunctionDeclarationNode);
      }
    }

    return this.module;
  }

  private processGlobalDeclaration(decl: DeclarationNode): void {
    const irType = this.dataTypeToIRType(this.parseType(decl.varType));
    
    let initializer: IRConstant | undefined;
    if (decl.initializer && decl.initializer.type === NodeType.NUMBER_LITERAL) {
      const literal = decl.initializer as NumberLiteralNode;
      initializer = createConstant(parseInt(literal.value), irType);
    }

    this.module.globals.push({
      name: decl.name,
      type: irType,
      initializer,
    });
  }

  private processFunctionDeclaration(funcDecl: FunctionDeclarationNode): void {
    const returnType = this.dataTypeToIRType(this.parseType(funcDecl.returnType));
    const parameters = funcDecl.parameters.map(param => ({
      name: param.name,
      type: this.dataTypeToIRType(this.parseType(param.varType)),
    }));

    const irFunction: IRFunction = {
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
      const paramValue = createValue(param.name, param.type);
      const allocaInstr = createInstruction(
        this.genId(),
        IROpCode.ALLOCA,
        param.type,
        []
      );
      entryBlock.instructions.push(allocaInstr);
      
      const storeInstr = createInstruction(
        this.genId(),
        IROpCode.STORE,
        IRType.VOID,
        [paramValue, createValue(this.genId(), param.type)] // Use temporary value for parameter
      );
      entryBlock.instructions.push(storeInstr);
      
      this.context.valueMap.set(param.name, allocaInstr as IRValue);
    }

    // Process function body
    this.processStatement(funcDecl.body);

    this.module.functions.push(irFunction);
    this.context.currentFunction = null;
  }

  private processStatement(stmt: StatementNode): void {
    switch (stmt.type) {
      case NodeType.DECLARATION:
        this.processVariableDeclaration(stmt as DeclarationNode);
        break;

      case NodeType.ASSIGNMENT:
        this.processAssignment(stmt as AssignmentNode);
        break;

      case NodeType.IF_STATEMENT:
        this.processIfStatement(stmt as IfStatementNode);
        break;

      case NodeType.WHILE_STATEMENT:
        this.processWhileStatement(stmt as WhileStatementNode);
        break;

      case NodeType.FOR_STATEMENT:
        this.processForStatement(stmt as ForStatementNode);
        break;

      case NodeType.RETURN_STATEMENT:
        this.processReturnStatement(stmt as ReturnStatementNode);
        break;

      case NodeType.EXPRESSION_STATEMENT:
        this.processExpressionStatement(stmt as ExpressionStatementNode);
        break;

      case NodeType.COMPOUND_STATEMENT:
        this.processCompoundStatement(stmt as any);
        break;
    }
  }

  private processVariableDeclaration(decl: DeclarationNode): void {
    if (!this.context.currentFunction || !this.context.currentBlock) {
      throw new Error('Variable declaration outside function');
    }

    const varType = this.dataTypeToIRType(this.parseType(decl.varType));
    
    // Allocate space on stack
    const allocaInstr = createInstruction(
      this.genId(),
      IROpCode.ALLOCA,
      varType,
      []
    );
    this.context.currentBlock.instructions.push(allocaInstr);

    // Store in symbol table
    this.context.valueMap.set(decl.name, allocaInstr as IRValue);

    // Initialize if needed
    if (decl.initializer) {
      const initValue = this.processExpression(decl.initializer);
      const storeInstr = createInstruction(
        this.genId(),
        IROpCode.STORE,
        IRType.VOID,
        [initValue, allocaInstr as IRValue]
      );
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

  private processAssignment(assign: AssignmentNode): void {
    if (!this.context.currentBlock) {
      throw new Error('Assignment outside block');
    }

    let targetAddr: IRValue;

    if (assign.target.type === NodeType.IDENTIFIER) {
      const addr = this.context.valueMap.get(assign.target.name);
      if (!addr) {
        throw new Error(`Variable ${assign.target.name} not declared`);
      }
      targetAddr = addr;
    } else {
      throw new Error('Unsupported assignment target');
    }

    const value = this.processExpression(assign.value);
    const storeInstr = createInstruction(
      this.genId(),
      IROpCode.STORE,
      IRType.VOID,
      [value, targetAddr]
    );
    this.context.currentBlock.instructions.push(storeInstr);
  }

  private processIfStatement(ifStmt: IfStatementNode): void {
    if (!this.context.currentFunction || !this.context.currentBlock) {
      throw new Error('If statement outside function');
    }

    const condition = this.processExpression(ifStmt.condition);
    
    const thenBlock = this.createNewBlock('then');
    const elseBlock = ifStmt.elseBranch ? this.createNewBlock('else') : null;
    const mergeBlock = this.createNewBlock('merge');

    // Conditional jump
      const jumpIfInstr: IRJumpIf = {
        condition: condition as IRValue,
        trueTarget: thenBlock.label,
        falseTarget: elseBlock ? elseBlock.label : mergeBlock.label,
      };
      this.context.currentBlock.instructions.push(jumpIfInstr);

    // Process then branch
    this.context.currentFunction.body.push(thenBlock);
    this.context.currentBlock = thenBlock;
    this.processStatement(ifStmt.thenBranch as StatementNode);
    if (this.context.currentBlock) {
      this.context.currentBlock.instructions.push({ target: mergeBlock.label } as IRJump);
    }

    // Process else branch if present
    if (elseBlock && ifStmt.elseBranch) {
      this.context.currentFunction.body.push(elseBlock);
      this.context.currentBlock = elseBlock;
      this.processStatement(ifStmt.elseBranch as StatementNode);
      if (this.context.currentBlock) {
        this.context.currentBlock.instructions.push({ target: mergeBlock.label } as IRJump);
      }
    }

    // Continue in merge block
    this.context.currentFunction.body.push(mergeBlock);
    this.context.currentBlock = mergeBlock;
  }

  private processWhileStatement(whileStmt: WhileStatementNode): void {
    if (!this.context.currentFunction || !this.context.currentBlock) {
      throw new Error('While statement outside function');
    }

    const condBlock = this.createNewBlock('while.cond');
    const bodyBlock = this.createNewBlock('while.body');
    const afterBlock = this.createNewBlock('while.after');

    // Jump to condition
    this.context.currentBlock.instructions.push({ target: condBlock.label } as IRJump);

    // Condition block
    this.context.currentFunction.body.push(condBlock);
    this.context.currentBlock = condBlock;
    const condition = this.processExpression(whileStmt.condition);
    
    const jumpIfInstr: IRJumpIf = {
      condition: condition as IRValue,
      trueTarget: bodyBlock.label,
      falseTarget: afterBlock.label,
    };
    this.context.currentBlock.instructions.push(jumpIfInstr);

    // Body block
    this.context.currentFunction.body.push(bodyBlock);
    this.context.currentBlock = bodyBlock;
    this.processStatement(whileStmt.body as StatementNode);
    if (this.context.currentBlock) {
      this.context.currentBlock.instructions.push({ target: condBlock.label } as IRJump);
    }

    // After block
    this.context.currentFunction.body.push(afterBlock);
    this.context.currentBlock = afterBlock;
  }

  private processForStatement(forStmt: ForStatementNode): void {
    if (!this.context.currentFunction || !this.context.currentBlock) {
      throw new Error('For statement outside function');
    }

    const condBlock = this.createNewBlock('for.cond');
    const bodyBlock = this.createNewBlock('for.body');
    const incBlock = this.createNewBlock('for.inc');
    const afterBlock = this.createNewBlock('for.after');

    // Process initialization
    if (forStmt.initialization) {
      if (forStmt.initialization.type === NodeType.DECLARATION) {
        this.processVariableDeclaration(forStmt.initialization as DeclarationNode);
      } else {
        this.processExpressionStatement(forStmt.initialization as ExpressionStatementNode);
      }
    }

    // Jump to condition
    this.context.currentBlock.instructions.push({ target: condBlock.label } as IRJump);

    // Condition block
    this.context.currentFunction.body.push(condBlock);
    this.context.currentBlock = condBlock;
    
    let condition: IRValue | IRConstant;
    if (forStmt.condition) {
      condition = this.processExpression(forStmt.condition);
    } else {
      condition = createConstant(1, IRType.I32); // Always true
    }
    
    const jumpIfInstr: IRJumpIf = {
      condition: condition as IRValue,
      trueTarget: bodyBlock.label,
      falseTarget: afterBlock.label,
    };
    this.context.currentBlock.instructions.push(jumpIfInstr);

    // Body block
    this.context.currentFunction.body.push(bodyBlock);
    this.context.currentBlock = bodyBlock;
    this.processStatement(forStmt.body as StatementNode);
    if (this.context.currentBlock) {
      this.context.currentBlock.instructions.push({ target: incBlock.label } as IRJump);
    }

    // Increment block
    this.context.currentFunction.body.push(incBlock);
    this.context.currentBlock = incBlock;
    if (forStmt.increment) {
      this.processExpression(forStmt.increment);
    }
    this.context.currentBlock.instructions.push({ target: condBlock.label } as IRJump);

    // After block
    this.context.currentFunction.body.push(afterBlock);
    this.context.currentBlock = afterBlock;
  }

  private processReturnStatement(retStmt: ReturnStatementNode): void {
    if (!this.context.currentBlock) {
      throw new Error('Return statement outside block');
    }

    let value: IRValue | IRConstant | undefined;
    if (retStmt.value) {
      value = this.processExpression(retStmt.value);
    }

    const retInstr: IRRet = {
      value,
      type: value ? (value as IRValue).type || IRType.I32 : IRType.VOID,
    };
    this.context.currentBlock.instructions.push(retInstr);
  }

  private processExpressionStatement(exprStmt: ExpressionStatementNode): void {
    this.processExpression(exprStmt.expression);
  }

  private processCompoundStatement(compound: any): void {
    for (const stmt of compound.statements) {
      if (this.context.currentBlock) { // Check if we haven't hit a return
        this.processStatement(stmt);
      }
    }
  }

  private processExpression(expr: ExpressionNode): IRValue | IRConstant {
    switch (expr.type) {
      case NodeType.ASSIGNMENT:
        this.processAssignment(expr as AssignmentNode);
        // Return the assigned value
        const target = this.context.valueMap.get((expr as AssignmentNode).target.name);
        if (!target) {
          throw new Error(`Variable ${(expr as AssignmentNode).target.name} not declared`);
        }
        if (!this.context.currentBlock) {
          throw new Error('Assignment outside block');
        }
        const loadInstr = createInstruction(
          this.genId(),
          IROpCode.LOAD,
          target.type,
          [target]
        );
        this.context.currentBlock.instructions.push(loadInstr);
        return loadInstr as IRValue;

      case NodeType.BINARY_EXPRESSION:
        return this.processBinaryExpression(expr as BinaryExpressionNode);

      case NodeType.UNARY_EXPRESSION:
        return this.processUnaryExpression(expr as UnaryExpressionNode);

      case NodeType.FUNCTION_CALL:
        return this.processFunctionCall(expr as FunctionCallNode);

      case NodeType.IDENTIFIER:
        return this.processIdentifier(expr as IdentifierNode);

      case NodeType.NUMBER_LITERAL:
        return this.processNumberLiteral(expr as NumberLiteralNode);

      case NodeType.CHARACTER_LITERAL:
        return this.processCharacterLiteral(expr as CharacterLiteralNode);

      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  }

  private processBinaryExpression(binary: BinaryExpressionNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Binary expression outside block');
    }

    const left = this.processExpression(binary.left);
    const right = this.processExpression(binary.right);

    let opcode: IROpCode;
    switch (binary.operator) {
      case '+': opcode = IROpCode.ADD; break;
      case '-': opcode = IROpCode.SUB; break;
      case '*': opcode = IROpCode.MUL; break;
      case '/': opcode = IROpCode.DIV; break;
      case '%': opcode = IROpCode.MOD; break;
      case '==': opcode = IROpCode.EQ; break;
      case '!=': opcode = IROpCode.NE; break;
      case '<': opcode = IROpCode.LT; break;
      case '<=': opcode = IROpCode.LE; break;
      case '>': opcode = IROpCode.GT; break;
      case '>=': opcode = IROpCode.GE; break;
      case '&&': opcode = IROpCode.AND; break;
      case '||': opcode = IROpCode.OR; break;
      default:
        throw new Error(`Unsupported binary operator: ${binary.operator}`);
    }

    const resultType = this.getOperationResultType(opcode, left, right);
    const result = createInstruction(
      this.genId(),
      opcode,
      resultType,
      [left, right]
    );

    this.context.currentBlock.instructions.push(result);
    return result as IRValue;
  }

  private processUnaryExpression(unary: UnaryExpressionNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Unary expression outside block');
    }

    // Handle address-of (&) and dereference (*)
    if (unary.operator === '&') {
      if (unary.operand.type !== NodeType.IDENTIFIER) {
        throw new Error('Cannot take address of non-identifier');
      }
      const ident = unary.operand as IdentifierNode;
      const varAddr = this.context.valueMap.get(ident.name);
      if (!varAddr) {
        throw new Error(`Variable ${ident.name} not declared`);
      }
      return varAddr;
    }

    if (unary.operator === '*') {
      const ptrValue = this.processExpression(unary.operand);
      const resultType = isPointerType((ptrValue as IRValue).type) ? 
        this.getPointedToType((ptrValue as IRValue).type) : IRType.I32;
      
      const loadInstr = createInstruction(
        this.genId(),
        IROpCode.LOAD,
        resultType,
        [ptrValue]
      );
      this.context.currentBlock.instructions.push(loadInstr);
      return loadInstr as IRValue;
    }

    const operand = this.processExpression(unary.operand);

    let opcode: IROpCode;
    switch (unary.operator) {
      case '-': opcode = IROpCode.SUB; break;
      case '!': opcode = IROpCode.NOT; break;
      case '++_post':
      case '--_post':
        // Handle post-increment/decrement: load value, compute new value, store back
        const incrementValue = unary.operator === '++_post' ? 
          createConstant(1, IRType.I32) : createConstant(-1, IRType.I32);
        
        if (unary.operand.type === NodeType.IDENTIFIER) {
          const ident = unary.operand as IdentifierNode;
          const addr = this.context.valueMap.get(ident.name);
          if (addr) {
            const currentVal = createInstruction(this.genId(), IROpCode.LOAD, addr.type, [addr]);
            this.context.currentBlock.instructions.push(currentVal);
            
            const newVal = createInstruction(this.genId(), IROpCode.ADD, addr.type, [currentVal as IRValue, incrementValue]);
            this.context.currentBlock.instructions.push(newVal);
            
            const store = createInstruction(this.genId(), IROpCode.STORE, IRType.VOID, [newVal as IRValue, addr]);
            this.context.currentBlock.instructions.push(store);
            
            return currentVal as IRValue;
          }
        }
        throw new Error('Postfix increment/decrement only supported on identifiers for now');

      default:
        throw new Error(`Unsupported unary operator: ${unary.operator}`);
    }

    if (unary.operator === '-') {
      const zero = createConstant(0, (operand as IRValue).type);
      const result = createInstruction(
        this.genId(),
        opcode,
        (operand as IRValue).type,
        [zero, operand]
      );
      this.context.currentBlock.instructions.push(result);
      return result as IRValue;
    } else {
      const result = createInstruction(
        this.genId(),
        opcode,
        IRType.I32,
        [operand]
      );
      this.context.currentBlock.instructions.push(result);
      return result as IRValue;
    }
  }

  private processFunctionCall(call: FunctionCallNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Function call outside block');
    }

    const args = call.arguments.map(arg => this.processExpression(arg));

    const callInstr: IRCall = {
      callee: call.name,
      args,
      type: IRType.I32, // Default for now
    };
    this.context.currentBlock.instructions.push(callInstr);

    // Return a temporary value representing the call result
    return createValue(this.genId(), callInstr.type);
  }

  private processIdentifier(ident: IdentifierNode): IRValue {
    // Check if it's a global variable
    const global = this.module.globals.find(g => g.name === ident.name);
    if (global) {
      // For global variables, create a load instruction
      if (!this.context.currentBlock) {
        throw new Error('Identifier access outside block');
      }
      
      const globalValue = createValue(ident.name, global.type);
      const loadInstr = createInstruction(
        this.genId(),
        IROpCode.LOAD,
        global.type,
        [globalValue]
      );
      this.context.currentBlock.instructions.push(loadInstr);
      return loadInstr as IRValue;
    }

    // Check local variables
    const varAddr = this.context.valueMap.get(ident.name);
    if (!varAddr) {
      throw new Error(`Variable ${ident.name} not declared`);
    }

    if (!this.context.currentBlock) {
      throw new Error('Identifier access outside block');
    }

    const loadInstr = createInstruction(
      this.genId(),
      IROpCode.LOAD,
      varAddr.type,
      [varAddr]
    );
    this.context.currentBlock.instructions.push(loadInstr);

    return loadInstr as IRValue;
  }

  private processNumberLiteral(literal: NumberLiteralNode): IRConstant {
    const value = parseInt(literal.value);
    return createConstant(value, IRType.I32);
  }

  private processCharacterLiteral(literal: CharacterLiteralNode): IRConstant {
    const value = literal.value.charCodeAt(1); // Skip the opening quote
    return createConstant(value, IRType.I8);
  }

  private dataTypeToIRType(dataType: DataType): IRType {
    if (dataType.isPointer) {
      return IRType.PTR;
    }
    
    switch (dataType.baseType) {
      case 'int': return IRType.I32;
      case 'char': return IRType.I8;
      case 'void': return IRType.VOID;
      default: return IRType.I32;
    }
  }

  private parseType(typeNode: TypeSpecifierNode): DataType {
    let baseType: any;
    let structName: string | undefined;

    if (typeNode.typeName.startsWith('struct ')) {
      baseType = 'struct';
      structName = typeNode.typeName.substring(7);
    } else {
      baseType = typeNode.typeName;
    }

    return {
      baseType,
      isPointer: typeNode.isPointer,
      pointerCount: typeNode.pointerCount,
      structName,
    };
  }

  private getPointedToType(ptrType: IRType): IRType {
    // Simplified: if it's a pointer, it points to I32 for now
    // A better implementation would store the pointed-to type in IRType
    return IRType.I32;
  }

  private getOperationResultType(opcode: IROpCode, left: IRValue | IRConstant, right: IRValue | IRConstant): IRType {
    // For now, assume all operations return I32
    return IRType.I32;
  }

  private createNewBlock(prefix: string): IRBlock {
    return {
      label: `${prefix}_${this.context.labelCounter++}`,
      instructions: [],
    };
  }

  private genId(): string {
    return `t${this.context.nextId++}`;
  }
}