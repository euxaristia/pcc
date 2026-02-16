import {
  ProgramNode, FunctionDeclarationNode, DeclarationNode, AssignmentNode,
  IfStatementNode, WhileStatementNode, ForStatementNode, DoWhileStatementNode,
  GotoStatementNode, LabelStatementNode, ReturnStatementNode,
  ExpressionStatementNode, BinaryExpressionNode, UnaryExpressionNode,
  TernaryExpressionNode, FunctionCallNode, IdentifierNode, NumberLiteralNode,
  StringLiteralNode, CharacterLiteralNode, NodeType, ExpressionNode, StatementNode,
  TypeSpecifierNode, SizeofExpressionNode, CastExpressionNode, MemberAccessNode,
  ArrayAccessNode, EnumDeclarationNode, UnionDeclarationNode, AttributeNode,
  InitializerListNode, MultiDeclarationNode
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
    
    // First pass: process global variable declarations and enums
    for (const decl of program.declarations) {
      if (decl.type === NodeType.DECLARATION) {
        this.processGlobalDeclaration(decl as DeclarationNode);
      } else if (decl.type === NodeType.ENUM_DECLARATION) {
        this.processEnumDeclaration(decl as EnumDeclarationNode);
      }
      // Unions are handled like structs for now
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
    const type = this.parseType(decl.varType);
    const irType = this.dataTypeToIRType(type);
    
    let initializer: IRConstant | IRConstant[] | undefined;
    let isArray = false;
    let arraySize = 0;

    if (decl.initializer) {
      if (decl.initializer.type === NodeType.NUMBER_LITERAL) {
        initializer = this.processNumberLiteral(decl.initializer as NumberLiteralNode);
      } else if (decl.initializer.type === NodeType.INITIALIZER_LIST) {
        const list = decl.initializer as InitializerListNode;
        const initializers: IRConstant[] = [];
        
        for (const init of list.initializers) {
          if (init.value.type === NodeType.NUMBER_LITERAL) {
            initializers.push(this.processNumberLiteral(init.value as NumberLiteralNode));
          } else {
            initializers.push(createConstant(0, irType));
          }
        }
        
        initializer = initializers;
        isArray = true;
        arraySize = initializers.length;
      }
    }

    this.module.globals.push({
      name: decl.name,
      type: irType,
      initializer,
      isArray,
      arraySize,
    });
  }

  private processEnumDeclaration(enumDecl: EnumDeclarationNode): void {
    // For now, we'll just treat enum values as integer constants
    // In a full implementation, we'd store them in a symbol table
    let nextValue = 0;
    for (const enumValue of enumDecl.values) {
      if (enumValue.value) {
        // If there's an explicit value, parse it
        const value = this.processExpression(enumValue.value);
        if ('value' in value) {
          nextValue = (value as IRConstant).value + 1;
        }
      } else {
        // Auto-increment
        nextValue++;
      }
    }
  }

  private processFunctionDeclaration(funcDecl: FunctionDeclarationNode): void {
    if (!funcDecl.body) {
      return;
    }
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
        [paramValue, allocaInstr as IRValue]
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

      case NodeType.MULTI_DECLARATION:
        (stmt as MultiDeclarationNode).declarations.forEach(decl => {
          this.processVariableDeclaration(decl);
        });
        break;

      case NodeType.EMPTY_STATEMENT:
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

      case NodeType.DO_WHILE_STATEMENT:
        this.processDoWhileStatement(stmt as DoWhileStatementNode);
        break;

      case NodeType.GOTO_STATEMENT:
        this.processGotoStatement(stmt as GotoStatementNode);
        break;

      case NodeType.LABEL_STATEMENT:
        this.processLabelStatement(stmt as LabelStatementNode);
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

      case NodeType.ASM_STATEMENT:
        this.processAsmStatement(stmt as any);
        break;

      case NodeType.ATTRIBUTE_STMT:
        // Ignore attributes for now
        break;

      case NodeType.INITIALIZER_LIST:
        // Handle as expression
        this.processExpression(stmt as any);
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

  private processAssignment(assign: AssignmentNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Assignment outside block');
    }

    let targetAddr: IRValue;

    if (assign.target.type === NodeType.IDENTIFIER) {
      const targetName = (assign.target as IdentifierNode).name;
      const addr = this.context.valueMap.get(targetName);
      if (!addr) {
        // Check if it's a global variable
        const global = this.module.globals.find(g => g.name === targetName);
        if (global) {
          targetAddr = createValue(global.name, IRType.PTR);
        } else {
          throw new Error(`Variable ${targetName} not declared`);
        }
      } else {
        targetAddr = addr;
      }
    } else if (assign.target.type === NodeType.MEMBER_ACCESS) {
      // For now, treat member access like a variable by finding the base
      const memberAccess = assign.target as MemberAccessNode;
      let current: any = memberAccess.object;
      // Handle chained member access: a.b.c -> get 'a'
      while (current.type === NodeType.MEMBER_ACCESS) {
        current = current.object;
      }
      // Handle dereference: (*ptr).member -> get 'ptr'
      if (current.type === NodeType.UNARY_EXPRESSION && current.operator === '*') {
        current = current.operand;
      }
      if (current.type === NodeType.IDENTIFIER) {
        const baseName = current.name;
        const addr = this.context.valueMap.get(baseName);
        if (!addr) {
          // Check if it's a global variable
          const global = this.module.globals.find(g => g.name === baseName);
          if (global) {
            targetAddr = createValue(global.name, IRType.PTR);
          } else {
            throw new Error(`Variable ${baseName} not declared`);
          }
        } else {
          targetAddr = addr;
        }
      } else {
        throw new Error('Unsupported member access target');
      }
    } else if (assign.target.type === NodeType.ARRAY_ACCESS) {
      // For now, treat array access like a variable
      // A full implementation would calculate the element address
      const arrayAccess = assign.target;
      if (arrayAccess.array.type === NodeType.IDENTIFIER) {
        const arrayName = arrayAccess.array.name;
        const addr = this.context.valueMap.get(arrayName);
        if (!addr) {
          throw new Error(`Variable ${arrayName} not declared`);
        }
        targetAddr = addr;
      } else {
        throw new Error('Unsupported array access target');
      }
    } else if (assign.target.type === NodeType.UNARY_EXPRESSION && (assign.target as UnaryExpressionNode).operator === '*') {
      // Dereference target: *ptr = value
      // The address is the value of the pointer expression
      targetAddr = this.processExpression((assign.target as UnaryExpressionNode).operand) as IRValue;
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
    
    // Return the assigned value
    return value as IRValue;
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

  private processDoWhileStatement(doWhileStmt: DoWhileStatementNode): void {
    if (!this.context.currentFunction || !this.context.currentBlock) {
      throw new Error('Do-while statement outside function');
    }

    // Create blocks for the loop body, condition, and after
    const bodyBlock = this.createNewBlock('do_while_body');
    const condBlock = this.createNewBlock('do_while_cond');
    const afterBlock = this.createNewBlock('do_while_after');

    // Jump to body first
    this.context.currentBlock.instructions.push({ target: bodyBlock.label } as IRJump);

    // Process body
    this.context.currentFunction.body.push(bodyBlock);
    this.context.currentBlock = bodyBlock;
    this.processStatement(doWhileStmt.body as StatementNode);
    bodyBlock.instructions.push({ target: condBlock.label } as IRJump);

    // Process condition
    this.context.currentFunction.body.push(condBlock);
    this.context.currentBlock = condBlock;
    const condition = this.processExpression(doWhileStmt.condition);
    const jumpIfInstr: IRJumpIf = {
      condition: condition as IRValue,
      trueTarget: bodyBlock.label,
      falseTarget: afterBlock.label,
    };
    condBlock.instructions.push(jumpIfInstr);

    // Set current block to after block
    this.context.currentFunction.body.push(afterBlock);
    this.context.currentBlock = afterBlock;
  }

  private processGotoStatement(gotoStmt: GotoStatementNode): void {
    if (!this.context.currentBlock) {
      throw new Error('Goto statement outside block');
    }

    const jumpInstr: IRJump = {
      target: gotoStmt.label,
    };
    this.context.currentBlock.instructions.push(jumpInstr);
  }

  private processLabelStatement(labelStmt: LabelStatementNode): void {
    if (!this.context.currentFunction) {
      throw new Error('Label statement outside function');
    }

    // Create a new block for the label
    const labelBlock = this.createNewBlock(labelStmt.name);
    this.context.currentFunction.body.push(labelBlock);
    this.context.currentBlock = labelBlock;
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

  private processAsmStatement(asm: any): void {
    if (!this.context.currentBlock) {
      throw new Error('Asm statement outside block');
    }
    
    // Parse the assembly statement to extract constraints and improve codegen
    const assembly = asm.assembly;
    const isVolatile = asm.isVolatile;
    
    // Create a basic ASM instruction for now
    // In a full implementation, we'd parse the assembly template
    // and map constraints to specific registers
    const instr = createInstruction(
      this.genId(),
      IROpCode.ASM,
      IRType.VOID,
      []
    );
    
    instr.metadata = {
      assembly: assembly,
      isVolatile: isVolatile,
    };
    this.context.currentBlock.instructions.push(instr);
  }

  private processExpression(expr: ExpressionNode): IRValue | IRConstant {
    switch (expr.type) {
      case NodeType.ASSIGNMENT:
        return this.processAssignment(expr as AssignmentNode);

      case NodeType.BINARY_EXPRESSION:
        return this.processBinaryExpression(expr as BinaryExpressionNode);

      case NodeType.UNARY_EXPRESSION:
        return this.processUnaryExpression(expr as UnaryExpressionNode);

      case NodeType.POSTFIX_EXPRESSION:
        // Already handled via _post operator in processUnaryExpression
        return this.processUnaryExpression(expr as any);

      case NodeType.TERNARY_EXPRESSION:
        return this.processTernaryExpression(expr as TernaryExpressionNode);

      case NodeType.FUNCTION_CALL:
        return this.processFunctionCall(expr as FunctionCallNode);

      case NodeType.IDENTIFIER:
        return this.processIdentifier(expr as IdentifierNode);

      case NodeType.NUMBER_LITERAL:
        return this.processNumberLiteral(expr as NumberLiteralNode);

      case NodeType.CHARACTER_LITERAL:
        return this.processCharacterLiteral(expr as CharacterLiteralNode);

      case NodeType.STRING_LITERAL:
        return this.processStringLiteral(expr as StringLiteralNode);

      case NodeType.SIZEOF_EXPRESSION:
        return this.processSizeofExpression(expr as SizeofExpressionNode);

      case NodeType.CAST_EXPRESSION:
        return this.processCastExpression(expr as CastExpressionNode);

      case NodeType.MEMBER_ACCESS:
        return this.processMemberAccess(expr as MemberAccessNode);

      case NodeType.ARRAY_ACCESS:
        return this.processArrayAccess(expr as ArrayAccessNode);

      case NodeType.INITIALIZER_LIST:
        // For now, return a dummy constant
        // In a full implementation, we'd handle array/struct initialization
        return createConstant(0, IRType.I32);

      case NodeType.COMPOUND_LITERAL:
        // Compound literals evaluate to the address of the initializer
        // For now, return a dummy constant
        return createConstant(0, IRType.I32);

      default:
        const never: never = expr;
        throw new Error(`Unsupported expression type: ${never}`);
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
      case '<<': opcode = IROpCode.SHL; break;
      case '>>': opcode = IROpCode.SHR; break;
      case '&': opcode = IROpCode.BAND; break;
      case '|': opcode = IROpCode.BOR; break;
      case '^': opcode = IROpCode.BXOR; break;
      case '==': opcode = IROpCode.EQ; break;
      case '!=': opcode = IROpCode.NE; break;
      case '<': opcode = IROpCode.LT; break;
      case '<=': opcode = IROpCode.LE; break;
      case '>': opcode = IROpCode.GT; break;
      case '>=': opcode = IROpCode.GE; break;
      case '&&': opcode = IROpCode.AND; break;
      case '||': opcode = IROpCode.OR; break;
      case ',':
        // Comma operator: evaluate left, then right, result is right
        return right as IRValue;
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
      // Handle taking address of member access: &ptr->member or &struct.member
      if (unary.operand.type === NodeType.MEMBER_ACCESS) {
        const memberAccess = unary.operand as MemberAccessNode;
        let current: any = memberAccess.object;
        // Handle dereference: (*ptr).member -> get 'ptr'
        while (current.type === NodeType.MEMBER_ACCESS) {
          current = current.object;
        }
        if (current.type === NodeType.UNARY_EXPRESSION && current.operator === '*') {
          current = current.operand;
        }
        if (current.type === NodeType.IDENTIFIER) {
          const ident = current as IdentifierNode;
          const varAddr = this.context.valueMap.get(ident.name);
          if (!varAddr) {
            // Check if it's a global variable
            const global = this.module.globals.find(g => g.name === ident.name);
            if (global) {
              return createValue(global.name, IRType.PTR);
            }
            throw new Error(`Variable ${ident.name} not declared`);
          }
          return varAddr;
        }
      }
      if (unary.operand.type !== NodeType.IDENTIFIER) {
        throw new Error('Cannot take address of non-identifier');
      }
      const ident = unary.operand as IdentifierNode;
      const varAddr = this.context.valueMap.get(ident.name);
      if (!varAddr) {
        // Check if it's a global variable
        const global = this.module.globals.find(g => g.name === ident.name);
        if (global) {
          return createValue(global.name, IRType.PTR);
        }
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
      case '~': opcode = IROpCode.BNOT; break;
      case '++':
      case '--':
      case '++_post':
      case '--_post':
        const isPost = unary.operator.endsWith('_post');
        const incrementValue = (unary.operator === '++' || unary.operator === '++_post') ? 
          createConstant(1, IRType.I32) : createConstant(-1, IRType.I32);
        
        if (unary.operand.type === NodeType.IDENTIFIER) {
          const ident = unary.operand as IdentifierNode;
          const addr = this.context.valueMap.get(ident.name);
          if (addr) {
            const currentVal = createInstruction(this.genId(), IROpCode.LOAD, this.getPointedToType(addr.type), [addr]);
            this.context.currentBlock.instructions.push(currentVal);
            
            const newVal = createInstruction(this.genId(), IROpCode.ADD, currentVal.type, [currentVal as IRValue, incrementValue]);
            this.context.currentBlock.instructions.push(newVal);
            
            const store = createInstruction(this.genId(), IROpCode.STORE, IRType.VOID, [newVal as IRValue, addr]);
            this.context.currentBlock.instructions.push(store);
            
            return (isPost ? currentVal : newVal) as IRValue;
          }
        }
        throw new Error('Increment/decrement only supported on identifiers for now');

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

  private processTernaryExpression(ternary: TernaryExpressionNode): IRValue | IRConstant {
    if (!this.context.currentBlock) {
      throw new Error('Ternary expression outside block');
    }

    let condition = this.processExpression(ternary.condition);
    
    // Ensure condition is an IRValue (not a constant)
    if ('value' in condition) {
      const constVal = condition as IRConstant;
      const constValue = createInstruction(
        this.genId(),
        IROpCode.ADD, // Just copy the constant
        constVal.type,
        [constVal]
      );
      if (this.context.currentBlock) {
        this.context.currentBlock.instructions.push(constValue);
      }
      condition = constValue as IRValue;
    }
    
    // Create new blocks for the branches
    const trueBlock = this.createNewBlock('ternary_true');
    const falseBlock = this.createNewBlock('ternary_false');
    const endBlock = this.createNewBlock('ternary_end');
    
    // Jump to the appropriate block based on condition
    const jumpIfInstr: IRJumpIf = {
      condition,
      trueTarget: trueBlock.label,
      falseTarget: falseBlock.label,
    };
    this.context.currentBlock.instructions.push(jumpIfInstr);
    
    // Add blocks to function
    if (this.context.currentFunction) {
      this.context.currentFunction.body.push(trueBlock);
      this.context.currentFunction.body.push(falseBlock);
      this.context.currentFunction.body.push(endBlock);
    }
    
    // Process true branch
    this.context.currentBlock = trueBlock;
    const trueValue = this.processExpression(ternary.thenBranch);
    const trueJump: IRJump = { target: endBlock.label };
    trueBlock.instructions.push(trueJump);
    
    // Process false branch
    this.context.currentBlock = falseBlock;
    const falseValue = this.processExpression(ternary.elseBranch);
    const falseJump: IRJump = { target: endBlock.label };
    falseBlock.instructions.push(falseJump);
    
    // Set current block to end block and create phi
    this.context.currentBlock = endBlock;
    
    // For simplicity, we'll just return a new value
    // A proper implementation would need phi nodes to merge the two branches
    const resultType = 'value' in trueValue ? (trueValue as IRConstant).type : (trueValue as IRValue).type;
    return createValue(this.genId(), resultType);
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
    // Check if it's a function first (functions decay to function pointers)
    const func = this.module.functions.find(f => f.name === ident.name);
    if (func) {
      // In C, function names decay to function pointers
      // Return the function address as a constant value
      return createValue(ident.name, IRType.I32); // Function addresses are pointers
    }
    
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
    const valueStr = literal.value.toLowerCase();
    const isHex = valueStr.startsWith('0x');
    if (!isHex && valueStr.endsWith('f')) {
      return createConstant(parseFloat(literal.value), IRType.F32);
    }
    if (valueStr.includes('.') || valueStr.includes('e')) {
      return createConstant(parseFloat(literal.value), IRType.F64);
    }
    if (valueStr.endsWith('l')) {
      return createConstant(parseInt(literal.value), IRType.I64);
    }
    const value = parseInt(literal.value);
    return createConstant(value, IRType.I32);
  }

  private processCharacterLiteral(literal: CharacterLiteralNode): IRConstant {
    const value = literal.value.charCodeAt(1); // Skip the opening quote
    return createConstant(value, IRType.I8);
  }

  private processStringLiteral(literal: StringLiteralNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('String literal outside block');
    }

    // For now, we'll create a global constant for the string
    // In a full implementation, we'd allocate it in .rodata
    const stringId = this.genId();
    const stringGlobal = {
      name: `.str${stringId}`,
      type: IRType.PTR,
      initializer: createConstant(0, IRType.I32), // Placeholder
    };
    this.module.globals.push(stringGlobal);

    // Return a pointer to the string
    return createValue(stringGlobal.name, IRType.PTR);
  }

  private dataTypeToIRType(dataType: DataType): IRType {
    if (dataType.isPointer) {
      return IRType.PTR;
    }
    
    switch (dataType.baseType) {
      case 'int': return IRType.I32;
      case 'char': return IRType.I8;
      case 'long': return IRType.I64;
      case 'float': return IRType.F32;
      case 'double': return IRType.F64;
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
    const leftType = (left as IRValue).type || (left as IRConstant).type;
    const rightType = (right as IRValue).type || (right as IRConstant).type;

    if (leftType === IRType.F64 || rightType === IRType.F64) {
      return IRType.F64;
    }
    if (leftType === IRType.F32 || rightType === IRType.F32) {
      return IRType.F32;
    }
    if (leftType === IRType.I64 || rightType === IRType.I64) {
      return IRType.I64;
    }
    
    // Comparison operators always return I32 (boolean)
    if ([IROpCode.EQ, IROpCode.NE, IROpCode.LT, IROpCode.LE, IROpCode.GT, IROpCode.GE].includes(opcode)) {
      return IRType.I32;
    }

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

  private processSizeofExpression(expr: SizeofExpressionNode): IRConstant {
    // Calculate the size based on the operand type or expression
    let size: number;
    
    if (expr.isType) {
      // sizeof(type)
      const typeNode = expr.operand as TypeSpecifierNode;
      if (typeNode.isPointer) {
        // Pointer size on x86-64 is 8 bytes
        size = 8;
      } else {
        switch (typeNode.typeName) {
          case 'int': size = 4; break;
          case 'char': size = 1; break;
          case 'void': size = 1; break;
          default: size = 4;
        }
      }
    } else {
      // sizeof expression - need to get the type of the expression
      // For now, we'll just assume int (4 bytes) for expressions
      // In a full implementation, we'd analyze the expression to get its type
      const operandExpr = expr.operand as ExpressionNode;
      
      if (operandExpr.type === NodeType.IDENTIFIER) {
        // Look up the variable to get its type
        const ident = operandExpr as IdentifierNode;
        const varAddr = this.context.valueMap.get(ident.name);
        if (varAddr) {
          // Get size based on variable's IR type
          switch (varAddr.type) {
            case IRType.I8: size = 1; break;
            case IRType.I32: size = 4; break;
            case IRType.PTR: size = 8; break;
            default: size = 4;
          }
        } else {
          size = 4; // Default
        }
      } else if (operandExpr.type === NodeType.NUMBER_LITERAL) {
        size = 4; // int literal
      } else if (operandExpr.type === NodeType.CHARACTER_LITERAL) {
        size = 1; // char literal
      } else {
        size = 4; // Default to int size
      }
    }
    
    return createConstant(size, IRType.I32);
  }

  private processCastExpression(expr: CastExpressionNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Cast expression outside block');
    }

    // First, generate the operand
    const operand = this.processExpression(expr.operand);

    // Get the target type
    const targetType = this.dataTypeToIRType(this.parseType(expr.targetType));

    // If the types are the same, no conversion needed
    if ((operand as IRValue).type === targetType) {
      return operand as IRValue;
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

    return operand as IRValue;
  }

  private processMemberAccess(expr: MemberAccessNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Member access outside block');
    }

    // For now, find the base identifier and load from it
    // This is a simplified implementation that doesn't handle offsets correctly
    let current: ExpressionNode = expr;
    while (current.type === NodeType.MEMBER_ACCESS) {
      current = (current as MemberAccessNode).object;
    }
    
    if (current.type === NodeType.IDENTIFIER) {
      const objectName = (current as IdentifierNode).name;
      const varAddr = this.context.valueMap.get(objectName);
      if (varAddr) {
        const loadInstr = createInstruction(
          this.genId(),
          IROpCode.LOAD,
          IRType.I32,
          [varAddr]
        );
        this.context.currentBlock.instructions.push(loadInstr);
        return loadInstr as IRValue;
      }
    }
    
    return createConstant(0, IRType.I32) as any;
  }

  private processArrayAccess(expr: ArrayAccessNode): IRValue {
    if (!this.context.currentBlock) {
      throw new Error('Array access outside block');
    }

    // For now, just load from the base variable
    // A full implementation would:
    // 1. Calculate the element address: base + (index * element_size)
    // 2. Load from that address
    
    if (expr.array.type === NodeType.IDENTIFIER) {
      const arrayName = (expr.array as IdentifierNode).name;
      let varAddr = this.context.valueMap.get(arrayName);
      if (!varAddr) {
        // Check for global array
        const global = this.module.globals.find(g => g.name === arrayName);
        if (global) {
          varAddr = createValue(global.name, IRType.PTR);
        } else {
          throw new Error(`Variable ${arrayName} not declared`);
        }
      }
      
      // For now, just load the first element
      // In reality, we'd need to calculate the offset based on the index
      const loadInstr = createInstruction(
        this.genId(),
        IROpCode.LOAD,
        IRType.I32,
        [varAddr]
      );
      this.context.currentBlock.instructions.push(loadInstr);
      return loadInstr as IRValue;
    }
    
    throw new Error('Unsupported array access type');
  }
}