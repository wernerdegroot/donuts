import * as ts from "typescript";
import { readFileSync, writeFileSync } from "fs";
import transformerFactory from "./transformer";

// create compiler host, program, and then emit the results
// using our transform
const compilerOptions: ts.CompilerOptions = {
  outDir: "./test",
  noEmitOnError: true,
  target: ts.ScriptTarget.ES5
};
const compilerHost = ts.createCompilerHost(compilerOptions);
const program = ts.createProgram(["index.ts"], compilerOptions, compilerHost);

const fileNames = ["index.ts"];
fileNames.forEach(fileName => {
  // Parse a file
  let sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(fileName).toString(),
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true
  );

  const transformed = ts.transform(
    sourceFile,
    [transformerFactory(program)],
    compilerOptions
  );
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed
  });
  transformed.transformed.forEach(tr => {
    const result = printer.printNode(ts.EmitHint.Unspecified, tr, sourceFile);
    writeFileSync(tr.fileName + ".result.ts", result);
    console.log(result);
  });
});
