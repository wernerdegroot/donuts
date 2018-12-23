import * as ts from "typescript";
import * as fs from "fs";

export default (program: ts.Program): ts.TransformerFactory<ts.SourceFile> => {
  return (
    transformationContext: ts.TransformationContext
  ): ts.Transformer<ts.SourceFile> => {
    type VisitContext = { hasTransformed: boolean };
    const visitor = (sourceFile: ts.SourceFile, visitContext: VisitContext) => {
      return (node: ts.Node): ts.VisitResult<ts.Node> => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          if (node.expression.escapedText === "doTheThing") {
            const visited = visitDoTheThing(node);
            visitContext.hasTransformed = true;
            return visited;
          }
        }
        return ts.visitEachChild(
          node,
          visitor(sourceFile, visitContext),
          transformationContext
        );
      };
    };

    return (sourceFile: ts.SourceFile) => {
      const visitContext: VisitContext = { hasTransformed: false };
      const transformed = ts.visitNode(
        sourceFile,
        visitor(sourceFile, visitContext)
      );
      // if (visitContext.hasTransformed) {
      //   const transformedAsString = printer.printFile(transformed);
      //   // Create the language service host to allow the LS to communicate with the host
      //   const servicesHost: ts.LanguageServiceHost = {
      //     getScriptFileNames: () => [sourceFile.fileName],
      //     getScriptVersion: fileName => "0",
      //     getScriptSnapshot: fileName => {
      //       if (fileName === sourceFile.fileName) {
      //         return ts.ScriptSnapshot.fromString(transformedAsString);
      //       }

      //       if (!fs.existsSync(fileName)) {
      //         return undefined;
      //       }

      //       return ts.ScriptSnapshot.fromString(
      //         fs.readFileSync(fileName).toString()
      //       );
      //     },
      //     getCurrentDirectory: () => process.cwd(),
      //     getCompilationSettings: () => program.getCompilerOptions(),
      //     getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
      //     fileExists: ts.sys.fileExists,
      //     readFile: ts.sys.readFile,
      //     readDirectory: ts.sys.readDirectory
      //   };

      //   const services = ts.createLanguageService(
      //     servicesHost,
      //     ts.createDocumentRegistry()
      //   );

      //   const allDiagnostics = services
      //     .getCompilerOptionsDiagnostics()
      //     .concat(services.getSyntacticDiagnostics(sourceFile.fileName))
      //     .concat(services.getSemanticDiagnostics(sourceFile.fileName));

      //   console.log(allDiagnostics);

      //   const transpiledTransform = ts.transpileModule(transformedAsString, {
      //     compilerOptions: program.getCompilerOptions(),
      //     reportDiagnostics: true
      //   });
      //   console.log(transformedAsString);
      //   console.log(transpiledTransform.diagnostics);
      // }
      return transformed;
    };
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
    if (yielded === undefined) {
      throw new Error("Nothing yielded");
    }
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

    if (variable.initializer === undefined) {
      throw new Error("No initializer");
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
