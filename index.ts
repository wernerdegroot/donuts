import * as ts from "typescript";
import * as path from "path";
import transformerFactory from "./transformer";

const tsConfigFileNameRelative = process.argv[2];
const tsConfigFileName = path.resolve(process.cwd(), tsConfigFileNameRelative);
if (!ts.sys.fileExists(tsConfigFileName)) {
  console.error(`File ${tsConfigFileName} does not exist.`);
  process.exit(1);
}

const tsConfigRootDirectory = path.dirname(tsConfigFileName);

const parseConfigHost: ts.ParseConfigHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  useCaseSensitiveFileNames: true
};

const tsConfigFileContents = ts.readConfigFile(
  tsConfigFileName,
  ts.sys.readFile
);

const defaultFormatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getCanonicalFileName: fileName => fileName,
  getNewLine: () => ts.sys.newLine
};

if (tsConfigFileContents.error !== undefined) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(
      [tsConfigFileContents.error],
      defaultFormatHost
    )
  );
  process.exit(1);
}

const parsedCommandLine = ts.parseJsonConfigFileContent(
  tsConfigFileContents.config,
  parseConfigHost,
  tsConfigRootDirectory
);
if (parsedCommandLine.errors.length > 0) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(
      parsedCommandLine.errors,
      defaultFormatHost
    )
  );
  process.exit(1);
}

const transformedFiles: Map<string, string> = new Map();
function getScriptVersion(filePath: string): string {
  const transformed = transformedFiles.get(filePath);
  return transformed === undefined ? "0" : "1";
}

const servicesHost: ts.LanguageServiceHost = {
  getScriptFileNames: () => parsedCommandLine.fileNames,
  getScriptVersion: getScriptVersion,
  getScriptSnapshot: fileName => {
    const transformed = transformedFiles.get(fileName);
    if (transformed !== undefined) {
      return ts.ScriptSnapshot.fromString(transformed);
    }

    if (!ts.sys.fileExists(fileName)) {
      return undefined;
    }

    const fileContents = ts.sys.readFile(fileName);
    return fileContents === undefined
      ? undefined
      : ts.ScriptSnapshot.fromString(fileContents);
  },
  getCompilationSettings: () => parsedCommandLine.options,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory
};

const documentRegistry = ts.createDocumentRegistry();
const services = ts.createLanguageService(servicesHost, documentRegistry);

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed
});

const compilerHost = ts.createCompilerHost(parsedCommandLine.options);
const program = ts.createProgram(
  parsedCommandLine.fileNames,
  parsedCommandLine.options,
  compilerHost
);

let hasErrors = false;
parsedCommandLine.fileNames.forEach(fileName => {
  const fileContents = ts.sys.readFile(fileName);
  if (fileContents === undefined) {
    return;
  }
  const fileContentsScriptSnapshot = ts.ScriptSnapshot.fromString(fileContents);
  const sourceFile = documentRegistry.acquireDocument(
    fileName,
    parsedCommandLine.options,
    fileContentsScriptSnapshot,
    "0"
  );

  const transformed = ts.transform(
    sourceFile,
    [transformerFactory(program)],
    parsedCommandLine.options
  );
  if (
    transformed.diagnostics !== undefined &&
    transformed.diagnostics.length > 0
  ) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(
        transformed.diagnostics,
        defaultFormatHost
      )
    );
    hasErrors = true;
    return;
  }
  transformed.transformed.forEach(tr => {
    const printed = printer.printFile(tr);
    transformedFiles.set(fileName, printed);
    const allDiagnostics = services
      .getCompilerOptionsDiagnostics()
      .concat(services.getSyntacticDiagnostics(tr.fileName))
      .concat(services.getSemanticDiagnostics(tr.fileName));
    if (allDiagnostics.length > 0) {
      console.error(
        ts.formatDiagnosticsWithColorAndContext(
          allDiagnostics,
          defaultFormatHost
        )
      );
      hasErrors = true;
    }
  });
});

process.exit(hasErrors ? 1 : 0);
