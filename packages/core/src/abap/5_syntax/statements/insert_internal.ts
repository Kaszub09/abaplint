import * as Expressions from "../../2_statements/expressions";
import {StatementNode} from "../../nodes";
import {CurrentScope} from "../_current_scope";
import {InlineFS} from "../expressions/inline_fs";
import {Source} from "../expressions/source";
import {Target} from "../expressions/target";
import {FSTarget} from "../expressions/fstarget";
import {AbstractType} from "../../types/basic/_abstract_type";
import {AnyType, CharacterType, DataReference, StringType, TableType, UnknownType, VoidType} from "../../types/basic";
import {StatementSyntax} from "../_statement_syntax";
import {InlineData} from "../expressions/inline_data";
import {TypeUtils} from "../_type_utils";

export class InsertInternal implements StatementSyntax {
  public runSyntax(node: StatementNode, scope: CurrentScope, filename: string): void {

    let targetType: AbstractType | undefined;
    const t = node.findDirectExpression(Expressions.Target);
    if (t) {
      targetType = new Target().runSyntax(t, scope, filename);
    }
    if (!(targetType instanceof TableType)
        && !(targetType instanceof VoidType)
        && !(targetType instanceof AnyType)
        && !(targetType instanceof UnknownType)
        && targetType !== undefined) {
      throw new Error("INSERT target must be a table");
    } else if (targetType instanceof TableType
        && node.findDirectTokenByText("LINES") === undefined) {
      targetType = targetType.getRowType();
    }

    let source = node.findDirectExpression(Expressions.SimpleSource4);
    if (source === undefined) {
      source = node.findDirectExpression(Expressions.Source);
    }
    const sourceType = source ? new Source().runSyntax(source, scope, filename, targetType) : targetType;

    if (targetType === undefined
        && !(sourceType instanceof TableType)
        && !(sourceType instanceof VoidType)
        && !(sourceType instanceof AnyType)
        && !(sourceType instanceof UnknownType)) {
      throw new Error("INSERT target must be a table");
    }

    const afterAssigning = node.findExpressionAfterToken("ASSIGNING");
    if (afterAssigning?.get() instanceof Expressions.FSTarget) {
      const inlinefs = afterAssigning?.findDirectExpression(Expressions.InlineFS);
      if (inlinefs) {
        new InlineFS().runSyntax(inlinefs, scope, filename, sourceType);
      } else {
        new FSTarget().runSyntax(afterAssigning, scope, filename, sourceType);
      }
    }

    if (node.findDirectTokenByText("INITIAL") === undefined) {
      if (new TypeUtils(scope).isAssignableStrict(sourceType, targetType) === false) {
        throw new Error("Types not compatible");
      } else if (sourceType instanceof CharacterType && targetType instanceof StringType) {
        // yea, well, INSERT doesnt convert the values automatically, like everything else?
        throw new Error("Types not compatible");
      }
    }

    const afterInto = node.findExpressionAfterToken("INTO");
    if (afterInto?.get() instanceof Expressions.Target && sourceType) {
      const inline = afterInto.findDirectExpression(Expressions.InlineData);
      if (inline) {
        new InlineData().runSyntax(afterInto, scope, filename, new DataReference(sourceType));
      } else {
        new Target().runSyntax(afterInto, scope, filename);
      }
    }

    for (const s of node.findDirectExpressions(Expressions.Source)) {
      if (s === source) {
        continue;
      }
      new Source().runSyntax(s, scope, filename, targetType);
    }

  }
}