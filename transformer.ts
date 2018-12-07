import * as ts from "typescript";

export default (program: ts.Program): ts.TransformerFactory<ts.SourceFile> => {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.escapedText === "doTheThing") {
          const visited = visitDoTheThing(node);
          return visited;
        }
      }
      return ts.visitEachChild(node, visitor, context);
    };

    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor);
  };
};

function visitDoTheThing(callExpression: ts.CallExpression): ts.Expression {
  if (callExpression.arguments.length !== 2) {
    throw new Error("Need exactly two arguments.");
  }

  const typeClassArgument = callExpression.arguments[0];

  const generatorFunctionArgument = callExpression.arguments[1];

  if (!ts.isFunctionExpression(generatorFunctionArgument)) {
    throw new Error("Expected function expression.");
  }

  if (generatorFunctionArgument.parameters.length !== 0) {
    throw new Error("Expected function without parameters.");
  }

  const body = doSomethingWithStatement(
    typeClassArgument,
    generatorFunctionArgument.body.statements.slice()
  );

  return ts.createFunctionExpression(
    [],
    undefined,
    generatorFunctionArgument.name,
    generatorFunctionArgument.typeParameters,
    [],
    generatorFunctionArgument.type,
    ts.createBlock(body)
  );
}

function doSomethingWithStatement(
  typeclass: ts.Expression,
  statements: ts.Statement[]
): ts.Statement[] | ts.NodeArray<ts.Statement> {
  if (statements.length === 0) {
    return [];
  }

  const [statement, ...otherStatements] = statements;

  function processYieldExpression(
    parameters: [ts.BindingName, ts.TypeNode | undefined][],
    expression: ts.YieldExpression
  ) {
    const yielded = expression.expression;
    const flatMapCall = ts.createCall(
      ts.createPropertyAccess(typeclass, "flatMap"),
      [],
      [
        yielded,
        ts.createArrowFunction(
          [],
          [],
          parameters.map(([p, t]) =>
            ts.createParameter([], [], undefined, p, undefined, t)
          ),
          undefined,
          undefined,
          ts.createBlock(doSomethingWithStatement(typeclass, otherStatements))
        )
      ]
    );
    return [ts.createReturn(flatMapCall)];
  }

  if (
    ts.isExpressionStatement(statement) &&
    ts.isYieldExpression(statement.expression)
  ) {
    return processYieldExpression([], statement.expression);
  }

  if (
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.length === 1
  ) {
    const variable = statement.declarationList.declarations[0];

    if (!ts.isIdentifier(variable.name)) {
      throw new Error("Expected identifier");
    }

    if (!ts.isYieldExpression(variable.initializer)) {
      return [
        statement,
        ...doSomethingWithStatement(typeclass, otherStatements)
      ];
    }

    return processYieldExpression(
      [[variable.name, variable.type]],
      variable.initializer
    );
  }

  return [statement, ...doSomethingWithStatement(typeclass, otherStatements)];
}
