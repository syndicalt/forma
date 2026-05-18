#!/usr/bin/env node
import { createHash } from "node:crypto";
import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  FormaRuntime,
  generatePythonBindings,
  generateTypeScriptBindings,
  HttpJsonProvider,
  OpenAIResponsesProvider,
  parseForma,
  StaticProvider,
} from "@forma-lang/forma";
import type { FormaDiagnostic, FormaField, FormaResult, FormaTask, FormaValue, ModelProvider, ToolHost } from "@forma-lang/forma";

const execAsync = promisify(exec);

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(args: string[]): Promise<CliResult> {
  const [command, path, ...rest] = args;
  if (!command || !path || (command !== "check" && command !== "run" && command !== "eval" && command !== "eval-suite" && command !== "compare" && command !== "generate" && command !== "package-check" && command !== "package-init" && command !== "package-lock")) {
    return usage();
  }

  try {
    if (command === "package-init") {
      return await initializePackage(path, rest);
    }

    if (command === "package-check") {
      return await checkPackageManifest(path);
    }

    if (command === "package-lock") {
      return await lockPackageManifest(path, rest);
    }

    if (command === "compare") {
      return compareReports(path, rest);
    }

    if (command === "eval") {
      return evaluateFixture(path, rest);
    }

    if (command === "eval-suite") {
      return evaluateSuite(path, rest);
    }

    const source = await readFile(path, "utf8");

    if (command === "generate") {
      return generateBindings(source, rest);
    }

    if (command === "check") {
      const runtime = new FormaRuntime();
      const result = await runtime.runSource(source, { input: {}, sourceName: path });
      if (result.diagnostics.length > 0) {
        return { exitCode: 1, stdout: "", stderr: formatDiagnostics(result.diagnostics) };
      }
      if (result.error?.startsWith("F3002")) {
        return { exitCode: 0, stdout: "ok\n", stderr: "" };
      }
      return result.error
        ? { exitCode: 1, stdout: "", stderr: `${result.error}\n` }
        : { exitCode: 0, stdout: "ok\n", stderr: "" };
    }

    const input = parseInput(rest);
    const evalOptions = await parseEvalOptions(rest);
    const modelProvider = evalOptions.provider === "fixture" ? undefined : createConfiguredProvider(evalOptions);
    const tools = createCliTools(rest);
    const runtimeOptions: { modelProvider?: ModelProvider; tools?: ToolHost } = {};
    if (modelProvider) runtimeOptions.modelProvider = modelProvider;
    if (tools) runtimeOptions.tools = tools;
    const runtime = new FormaRuntime(runtimeOptions);
    const taskName = optionValue(rest, "--task");
    const result = taskName
      ? await runtime.runTask(source, taskName, { input, sourceName: path })
      : await runtime.runSource(source, { input, sourceName: path });
    if (rest.includes("--report")) {
      return {
        exitCode: result.ok ? 0 : 1,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }
    return result.ok
      ? { exitCode: 0, stdout: `${JSON.stringify(result.output)}\n`, stderr: "" }
      : { exitCode: 1, stdout: "", stderr: `${result.error ?? "run failed"}\n` };
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: `${error instanceof Error ? error.message : String(error)}\n` };
  }
}

function usage(): CliResult {
  return { exitCode: 2, stdout: "", stderr: "usage: forma <check|run|eval|eval-suite|compare|generate|package-check|package-init|package-lock> <path> [--input JSON]\n" };
}

interface FormaPackageManifest {
  formaPackage: number;
  name?: string;
  version?: string;
  tasks?: Array<{
    name?: string;
    source?: string;
    sourceSha256?: string;
  }>;
  evalSuite?: string;
  bindings?: Array<{
    target?: string;
    source?: string;
    output?: string;
  }>;
  examples?: Array<{
    runtime?: string;
    path?: string;
  }>;
  providerProfile?: string;
  compatibility?: unknown;
}

async function checkPackageManifest(path: string): Promise<CliResult> {
  const manifest = JSON.parse(await readFile(path, "utf8")) as FormaPackageManifest;
  await validatePackageManifest(manifest, dirname(path));
  return { exitCode: 0, stdout: "ok\n", stderr: "" };
}

async function lockPackageManifest(path: string, args: string[]): Promise<CliResult> {
  const manifest = JSON.parse(await readFile(path, "utf8")) as FormaPackageManifest;
  const manifestDir = dirname(path);
  await validatePackageManifest(manifest, manifestDir);
  const lock = await createPackageLock(path, manifest, manifestDir);
  const serialized = `${JSON.stringify(lock, null, 2)}\n`;
  const outputPath = optionValue(args, "--output");
  if (args.includes("--check")) {
    if (!outputPath) {
      throw new Error("--output is required for --check");
    }
    const current = await readFile(outputPath, "utf8").catch(() => "");
    return current === serialized
      ? { exitCode: 0, stdout: "ok\n", stderr: "" }
      : { exitCode: 1, stdout: "", stderr: `package lock is out of date: ${outputPath}\n` };
  }
  if (outputPath) {
    await writeFile(outputPath, serialized, "utf8");
    return { exitCode: 0, stdout: "ok\n", stderr: "" };
  }
  return { exitCode: 0, stdout: serialized, stderr: "" };
}

async function initializePackage(path: string, args: string[]): Promise<CliResult> {
  const packageName = optionValue(args, "--name");
  const taskName = optionValue(args, "--task") ?? "review_diff";
  const kind = scaffoldKind(args);
  if (!packageName) {
    throw new Error("--name is required for package-init");
  }
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(packageName)) {
    throw new Error("invalid package name");
  }
  await mkdir(path, { recursive: true });

  const taskFile = `${taskName}.forma`;
  const typeScriptBindings = `${taskName}.forma.ts`;
  const pythonBindings = `${taskName}_forma.py`;
  const typeScriptExample = `${taskName}_package.ts`;
  const pythonExample = `${taskName}_package.py`;
  const evalFixture = `${taskName}.eval.json`;
  const evalSuite = "forma.eval.json";
  const manifestFile = `${taskName}.forma.pkg.json`;
  const lockFile = `${taskName}.forma.lock.json`;
  const providerProfileFile = "forma.provider.json";
  const readmeFile = "README.md";
  const schema = scaffoldSchema(args);
  const source = scaffoldSource(taskName, kind, schema);
  await writeFile(resolve(path, taskFile), source, "utf8");
  await writeFile(resolve(path, typeScriptBindings), generateTypeScriptBindings(source), "utf8");
  await writeFile(resolve(path, pythonBindings), generatePythonBindings(source), "utf8");
  await writeFile(resolve(path, typeScriptExample), scaffoldTypeScriptExample(taskName, kind, schema), "utf8");
  await writeFile(resolve(path, pythonExample), scaffoldPythonExample(taskName, kind, schema), "utf8");
  await writeFile(resolve(path, providerProfileFile), `${JSON.stringify(scaffoldProviderProfile(args), null, 2)}\n`, "utf8");
  await writeFile(resolve(path, evalFixture), `${JSON.stringify(scaffoldEvalFixture(taskName, taskFile, kind, schema), null, 2)}\n`, "utf8");
  await writeFile(resolve(path, evalSuite), `${JSON.stringify({ fixtures: [evalFixture] }, null, 2)}\n`, "utf8");
  const manifest = {
    formaPackage: 1,
    name: packageName,
    version: "0.1.0",
    description: "Review a code diff and return structured findings.",
    tasks: [
      {
        name: taskName,
        source: taskFile,
        sourceSha256: createHash("sha256").update(source).digest("hex"),
      },
    ],
    evalSuite,
    providerProfile: providerProfileFile,
    bindings: [
      { target: "typescript", source: taskFile, output: typeScriptBindings },
      { target: "python", source: taskFile, output: pythonBindings },
    ],
    examples: [
      { runtime: "typescript", path: typeScriptExample },
      { runtime: "python", path: pythonExample },
    ],
    compatibility: {
      breaking: ["input", "output", "schemas"],
      review: ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples"],
      environment: ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"],
    },
  };
  const manifestPath = resolve(path, manifestFile);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await validatePackageManifest(manifest, path);
  await writeFile(resolve(path, lockFile), `${JSON.stringify(await createPackageLock(manifestPath, manifest, path), null, 2)}\n`, "utf8");
  await writeFile(resolve(path, readmeFile), scaffoldPackageReadme(packageName, taskName, manifestFile, lockFile, evalSuite), "utf8");
  return { exitCode: 0, stdout: "ok\n", stderr: "" };
}

async function createPackageLock(path: string, manifest: FormaPackageManifest, manifestDir: string) {
  const profile = manifest.providerProfile
    ? JSON.parse(await readFile(resolve(manifestDir, manifest.providerProfile), "utf8")) as ProviderProfile
    : undefined;
  const providerProfile = profile && manifest.providerProfile
    ? {
        path: manifest.providerProfile,
        sha256: await hashFile(resolve(manifestDir, manifest.providerProfile)),
        provider: profile.provider,
        endpoint: profile.endpoint,
        model: profile.model,
        apiKeyEnv: profile.apiKeyEnv,
        responseFormat: profile.responseFormat,
        temperature: profile.temperature,
        timeoutMs: profile.timeoutMs,
      }
    : undefined;
  return omitUndefined({
    formaPackageLock: 1,
    package: {
      name: manifest.name,
      version: manifest.version,
      manifest: relative(manifestDir, resolve(path)),
      manifestSha256: await hashFile(path),
    },
    tasks: await Promise.all((manifest.tasks ?? []).map(async (task) => ({
      name: task.name,
      source: task.source,
      sourceSha256: await hashFile(resolve(manifestDir, task.source ?? "")),
    }))),
    evalSuite: {
      path: manifest.evalSuite,
      sha256: await hashFile(resolve(manifestDir, manifest.evalSuite ?? "")),
    },
    providerProfile,
    bindings: await Promise.all((manifest.bindings ?? []).map(async (binding) => ({
      target: binding.target,
      source: binding.source,
      output: binding.output,
      sha256: await hashFile(resolve(manifestDir, binding.output ?? "")),
    }))),
    examples: await Promise.all((manifest.examples ?? []).map(async (example) => ({
      runtime: example.runtime,
      path: example.path,
      sha256: await hashFile(resolve(manifestDir, example.path ?? "")),
    }))),
  });
}

async function hashFile(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, omitUndefined(entry)]),
  ) as T;
}

type ScaffoldKind = "review" | "tool";

interface ScaffoldField {
  name: string;
  type: string;
  optional: boolean;
  array: boolean;
}

interface ScaffoldSchema {
  input?: ScaffoldField[];
  output?: ScaffoldField[];
  outputObjects: Record<string, ScaffoldField[]>;
}

function scaffoldKind(args: string[]): ScaffoldKind {
  const kind = optionValue(args, "--kind") ?? "review";
  if (kind !== "review" && kind !== "tool") {
    throw new Error("--kind must be review or tool");
  }
  return kind;
}

function scaffoldSchema(args: string[]): ScaffoldSchema | undefined {
  const input = optionValues(args, "--input-field").map((value) => parseScaffoldField(value, "--input-field"));
  const output = optionValues(args, "--output-field").map((value) => parseScaffoldField(value, "--output-field"));
  const outputObjects = parseScaffoldObjects(optionValues(args, "--output-object"));
  if (input.length === 0 && output.length === 0 && Object.keys(outputObjects).length === 0) {
    return undefined;
  }
  return {
    ...(input.length > 0 ? { input } : {}),
    ...(output.length > 0 ? { output } : {}),
    outputObjects,
  };
}

function parseScaffoldObjects(values: string[]): Record<string, ScaffoldField[]> {
  const objects: Record<string, ScaffoldField[]> = {};
  for (const value of values) {
    const [path, type] = value.split(":");
    if (!path || !type) {
      throw new Error("--output-object must use Object.field:Type");
    }
    const [objectName, fieldName] = path.split(".");
    if (!objectName || !fieldName || path.split(".").length !== 2) {
      throw new Error("--output-object must use Object.field:Type");
    }
    validateScaffoldIdentifier(objectName, "--output-object object");
    const field = parseScaffoldField(`${fieldName}:${type}`, "--output-object");
    objects[objectName] = [...(objects[objectName] ?? []), field];
  }
  return objects;
}

function parseScaffoldField(value: string, flag: string): ScaffoldField {
  const [name, typeSpec] = value.split(":");
  if (!name || !typeSpec || value.split(":").length !== 2) {
    throw new Error(`${flag} must use name:Type`);
  }
  validateScaffoldIdentifier(name, flag);
  const array = typeSpec.endsWith("[]") || typeSpec.endsWith("[]?");
  const optional = typeSpec.endsWith("?");
  const type = typeSpec.replace(/\[\]\??$/, "").replace(/\?$/, "");
  validateScaffoldIdentifier(type, flag);
  return { name, type, optional, array };
}

function validateScaffoldIdentifier(value: string, flag: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${flag} contains an invalid identifier`);
  }
}

function scaffoldSource(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  return kind === "tool" ? scaffoldToolSource(taskName, schema) : scaffoldReviewSource(taskName, schema);
}

function scaffoldProviderProfile(args: string[]): ProviderProfile {
  const provider = optionValue(args, "--provider") ?? "openai-responses";
  if (provider !== "http-json" && provider !== "openai-responses") {
    throw new Error("--provider must be http-json or openai-responses");
  }
  const profile: ProviderProfile = {
    provider,
    model: optionValue(args, "--model") ?? "gpt-5",
    apiKeyEnv: optionValue(args, "--api-key-env") ?? "OPENAI_API_KEY",
    responseFormat: responseFormatOption(args) ?? "json_schema",
    temperature: numericOption(args, "--temperature") ?? 0.2,
    timeoutMs: numericOption(args, "--timeout-ms") ?? 30000,
  };
  const endpoint = optionValue(args, "--endpoint");
  if (endpoint) {
    profile.endpoint = endpoint;
  }
  if (provider === "http-json" && !profile.endpoint) {
    throw new Error("--endpoint is required for --provider http-json");
  }
  validateProviderProfile(profile);
  return profile;
}

function scaffoldReviewSource(taskName: string, schema?: ScaffoldSchema): string {
  const inputFields = effectiveInputFields("review", schema);
  const outputFields = effectiveOutputFields("review", schema);
  const outputObjects = effectiveOutputObjects("review", schema);
  return `task ${taskName} {
  intent "Review a code diff and produce structured review metadata"

  input {
${renderScaffoldFields(inputFields, "    ")}
  }

  output {
${renderScaffoldFields(outputFields, "    ")}
${renderScaffoldObjects(outputObjects, "    ")}
  }

  agent {
    instruction """
    Review the supplied code diff.
    Return a concise summary, structured findings, and whether the diff is clean.
    Do not include commentary outside the declared output fields.
    """
  }

  permissions {
    read
    search
    test
  }
}
`;
}

function scaffoldToolSource(taskName: string, schema?: ScaffoldSchema): string {
  const inputFields = effectiveInputFields("tool", schema);
  const outputFields = effectiveOutputFields("tool", schema);
  const outputObjects = effectiveOutputObjects("tool", schema);
  return `task ${taskName} {
  intent "Inspect a source file, run a focused test command, and write a small repair"

  input {
${renderScaffoldFields(inputFields, "    ")}
  }

  output {
${renderScaffoldFields(outputFields, "    ")}
${renderScaffoldObjects(outputObjects, "    ")}
  }

  agent {
    instruction """
    Use the host read, search, test, and edit tools to inspect a file, find related context,
    run a focused verification command, and apply a minimal repair when appropriate.
    Return only the declared structured output fields.
    """
  }

  permissions {
    read
    search
    test
    edit
  }
}
`;
}

function renderScaffoldFields(fields: ScaffoldField[], indent: string): string {
  return fields.map((field) => `${indent}${field.name}: ${field.type}${field.array ? "[]" : ""}${field.optional ? "?" : ""}`).join("\n");
}

function renderScaffoldObjects(objects: Record<string, ScaffoldField[]>, indent: string): string {
  return Object.entries(objects)
    .map(([name, fields]) => `\n${indent}object ${name} {\n${renderScaffoldFields(fields, `${indent}  `)}\n${indent}}`)
    .join("\n");
}

function scaffoldEvalFixture(taskName: string, taskFile: string, kind: ScaffoldKind, schema?: ScaffoldSchema) {
  if (schema) {
    const effectiveSchema = {
      outputObjects: effectiveOutputObjects(kind, schema),
    };
    const input = Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [field.name, scaffoldValue(field, effectiveSchema)]));
    const output = Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [field.name, scaffoldValue(field, effectiveSchema)]));
    return scaffoldAgentEvalFixture(taskName, taskFile, input, output);
  }
  if (kind === "tool") {
    const output = {
      summary: "Read src/example.ts, found related context, ran tests, and wrote a repair.",
      searched: true,
      test_passed: true,
      edited: true,
    };
    return {
      name: taskName,
      source: taskFile,
      input: {
        path: "src/example.ts",
        test_command: "pnpm test",
      },
      fakeProviderOutput: output,
      expectedResult: {
        ok: true,
        output,
        trace: [{ step: "agent", detail: taskName }],
        diagnostics: [],
        verification: { ok: true },
        error: null,
      },
    };
  }
  const output = {
    summary: "The diff needs review.",
    findings: [
      {
        path: "src/example.ts",
        line: 1,
        message: "Check the changed behavior.",
      },
    ],
    clean: false,
  };
  return scaffoldAgentEvalFixture(taskName, taskFile, {
    diff: "diff --git a/src/example.ts b/src/example.ts",
    max_findings: 3,
  }, output);
}

function scaffoldAgentEvalFixture(taskName: string, taskFile: string, input: Record<string, FormaValue>, output: Record<string, FormaValue>) {
  return {
    name: taskName,
    source: taskFile,
    input,
    fakeProviderOutput: output,
    expectedResult: {
      ok: true,
      output,
      trace: [{ step: "agent", detail: taskName }],
      diagnostics: [],
      verification: { ok: true },
      error: null,
    },
  };
}

function scaffoldPackageReadme(packageName: string, taskName: string, manifestFile: string, lockFile: string, evalSuite: string): string {
  return `# ${packageName}

This Forma package defines the \`${taskName}\` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

## CI

Run these checks before publishing or consuming a changed package:

\`\`\`bash
forma package-check ${manifestFile}
forma package-lock ${manifestFile} --output ${lockFile} --check
forma eval-suite ${evalSuite} --summary > candidate.json
forma compare baseline.json candidate.json --fail-on breaking,environment
\`\`\`

Commit the package manifest, lockfile, \`.forma\` source, eval suite, provider
profile, generated bindings, and host examples together so TypeScript and Python
consumers review the same contract.
`;
}

function scaffoldValue(field: ScaffoldField, schema: ScaffoldSchema): FormaValue {
  if (field.array) {
    return [scaffoldValue({ ...field, array: false, optional: false }, schema)] as FormaValue;
  }
  const nested = schema.outputObjects[field.type];
  if (nested) {
    return Object.fromEntries(nested.map((nestedField) => [nestedField.name, scaffoldValue(nestedField, schema)])) as FormaValue;
  }
  if (field.type === "Text") return field.name === "summary" ? "Example summary." : field.name === "message" ? "Example message." : "example";
  if (field.type === "Number") return 1;
  if (field.type === "Boolean") return true;
  return "example";
}

function effectiveInputFields(kind: ScaffoldKind, schema?: ScaffoldSchema): ScaffoldField[] {
  return schema?.input ?? (kind === "tool"
    ? [
        { name: "path", type: "Text", optional: false, array: false },
        { name: "test_command", type: "Text", optional: true, array: false },
      ]
    : [
        { name: "diff", type: "Text", optional: false, array: false },
        { name: "max_findings", type: "Number", optional: true, array: false },
      ]);
}

function effectiveOutputFields(kind: ScaffoldKind, schema?: ScaffoldSchema): ScaffoldField[] {
  return schema?.output ?? (kind === "tool"
    ? [
        { name: "summary", type: "Text", optional: false, array: false },
        { name: "searched", type: "Boolean", optional: false, array: false },
        { name: "test_passed", type: "Boolean", optional: false, array: false },
        { name: "edited", type: "Boolean", optional: false, array: false },
      ]
    : [
        { name: "summary", type: "Text", optional: false, array: false },
        { name: "findings", type: "Finding", optional: false, array: true },
        { name: "clean", type: "Boolean", optional: false, array: false },
      ]);
}

function effectiveOutputObjects(kind: ScaffoldKind, schema?: ScaffoldSchema): Record<string, ScaffoldField[]> {
  if (schema) {
    return schema.outputObjects;
  }
  return kind === "review"
    ? {
        Finding: [
          { name: "path", type: "Text", optional: false, array: false },
          { name: "line", type: "Number", optional: true, array: false },
          { name: "message", type: "Text", optional: false, array: false },
        ],
      }
    : {};
}

function scaffoldTypeScriptExample(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  if (kind === "tool") {
    return scaffoldToolTypeScriptExample(taskName);
  }
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderTypeScriptObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { fileURLToPath } from "node:url";
import { agent, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${inputType}, type ${pascalName}Output } from "./${taskName}.forma.js";

const providerProfile = providerProfileFromFile(fileURLToPath(new URL("./forma.provider.json", import.meta.url)));

const ${camelName} = agent({
  file: fileURLToPath(new URL("./${taskName}.forma", import.meta.url)),
  task: "${taskName}",
  provider: providerFromProfile(providerProfile),
});

const exampleInput: ${inputType} = ${exampleInput};

export async function run${pascalName}(input: ${inputType} = exampleInput): Promise<${pascalName}Output> {
  const result = await ${camelName}.run(input);
  if (!result.ok) {
    throw new Error(result.error ?? "Forma ${taskName} failed");
  }
  return assert${pascalName}Output(result.output);
}
`;
}

function scaffoldToolTypeScriptExample(taskName: string): string {
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  return `import { fileURLToPath } from "node:url";
import { agent, type FormaValue, type ModelProvider, type PermissionTools } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${pascalName}Output } from "./${taskName}.forma.js";

class ToolProvider implements ModelProvider {
  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const path = String(input.values.path);
    const testCommand = typeof input.values.test_command === "string" ? input.values.test_command : "pnpm test";
    const source = await input.tools.readText(path);
    const matches = await input.tools.searchText("NEEDS_FIX");
    const test = await input.tools.runTest(testCommand);
    await input.tools.writeText(path, source.replace("NEEDS_FIX", "fixed"));
    return {
      summary: \`Read \${path}, found \${matches.length} related matches, and ran \${testCommand}.\`,
      searched: matches.length > 0,
      test_passed: test.ok,
      edited: true,
    };
  }
}

const ${camelName} = agent({
  file: fileURLToPath(new URL("./${taskName}.forma", import.meta.url)),
  task: "${taskName}",
  provider: new ToolProvider(),
});

export async function run${pascalName}(path: string): Promise<${pascalName}Output> {
  const result = await ${camelName}.run({ path, test_command: "pnpm test" });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma ${taskName} failed");
  }
  return assert${pascalName}Output(result.output);
}
`;
}

function scaffoldPythonExample(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  if (kind === "tool") {
    return scaffoldToolPythonExample(taskName);
  }
  const pascalName = toPascalCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderPythonObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "    ");
  return `from pathlib import Path
from dataclasses import asdict

from forma import agent, provider_from_profile, provider_profile_from_file
from ${taskName}_forma import ${inputType}, ${pascalName}Output, assert_${taskName}_output


provider_profile = provider_profile_from_file(Path(__file__).with_name("forma.provider.json"))

${taskName} = agent(
    file=Path(__file__).with_name("${taskName}.forma"),
    task="${taskName}",
    provider=provider_from_profile(provider_profile),
)


example_input = ${inputType}.from_dict(${exampleInput})


def run_${taskName}(input: ${inputType} = example_input) -> ${pascalName}Output:
    result = ${taskName}.run(asdict(input))
    if not result.ok:
        raise RuntimeError(result.error or "Forma ${taskName} failed")
    return assert_${taskName}_output(result.output)
`;
}

function renderTypeScriptObject(value: Record<string, FormaValue>, indent: string): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const nextIndent = `${indent}  `;
  return `{\n${entries.map(([key, entry]) => `${nextIndent}${key}: ${renderTypeScriptValue(entry, nextIndent)},`).join("\n")}\n${indent}}`;
}

function renderTypeScriptValue(value: FormaValue, indent: string): string {
  if (Array.isArray(value)) {
    return `[${(value as FormaValue[]).map((entry) => renderTypeScriptValue(entry, indent)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return renderTypeScriptObject(value as Record<string, FormaValue>, indent);
  }
  return JSON.stringify(value);
}

function renderPythonObject(value: Record<string, FormaValue>, indent: string): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const nextIndent = `${indent}    `;
  return `{\n${entries.map(([key, entry]) => `${nextIndent}${JSON.stringify(key)}: ${renderPythonValue(entry, nextIndent)},`).join("\n")}\n${indent}}`;
}

function renderPythonValue(value: FormaValue, indent: string): string {
  if (Array.isArray(value)) {
    return `[${(value as FormaValue[]).map((entry) => renderPythonValue(entry, indent)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return renderPythonObject(value as Record<string, FormaValue>, indent);
  }
  return JSON.stringify(value);
}

function scaffoldToolPythonExample(taskName: string): string {
  const pascalName = toPascalCase(taskName);
  return `from pathlib import Path

from forma import FormaValue, PermissionTools, agent
from ${taskName}_forma import ${pascalName}Output, assert_${taskName}_output


class ToolProvider:
    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools,
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
    ) -> dict[str, FormaValue]:
        path = str(values["path"])
        test_command = str(values.get("test_command") or "pytest")
        source = tools.read_text(path)
        matches = tools.search_text("NEEDS_FIX")
        test = tools.run_test(test_command)
        tools.write_text(path, source.replace("NEEDS_FIX", "fixed"))
        return {
            "summary": f"Read {path}, found {len(matches)} related matches, and ran {test_command}.",
            "searched": len(matches) > 0,
            "test_passed": bool(test.get("ok")),
            "edited": True,
        }


${taskName} = agent(
    file=Path(__file__).with_name("${taskName}.forma"),
    task="${taskName}",
    provider=ToolProvider(),
)


def run_${taskName}(path: str) -> ${pascalName}Output:
    result = ${taskName}.run({"path": path, "test_command": "pytest"})
    if not result.ok:
        raise RuntimeError(result.error or "Forma ${taskName} failed")
    return assert_${taskName}_output(result.output)
`;
}

function toPascalCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function validatePackageManifest(manifest: FormaPackageManifest, manifestDir: string): Promise<void> {
  if (manifest.formaPackage !== 1) {
    throw new Error("formaPackage must be 1");
  }
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(manifest.name ?? "")) {
    throw new Error("invalid package name");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
    throw new Error("version must use x.y.z semver");
  }
  if (!Array.isArray(manifest.tasks) || manifest.tasks.length === 0) {
    throw new Error("tasks must be a non-empty array");
  }
  for (const task of manifest.tasks) {
    if (!task.name) throw new Error("task.name is required");
    if (!task.source) throw new Error("task.source is required");
    if (!task.sourceSha256) throw new Error("task.sourceSha256 is required");
    const sourcePath = resolve(manifestDir, task.source);
    const source = await readFile(sourcePath);
    const sourceHash = createHash("sha256").update(source).digest("hex");
    if (sourceHash !== task.sourceSha256) {
      throw new Error(`task sourceSha256 does not match ${sourcePath}`);
    }
  }
  if (!manifest.evalSuite || !manifest.evalSuite.endsWith(".json")) {
    throw new Error("evalSuite must point to a JSON suite");
  }
  await readFile(resolve(manifestDir, manifest.evalSuite));
  if (manifest.bindings !== undefined) {
    if (!Array.isArray(manifest.bindings)) {
      throw new Error("bindings must be an array");
    }
    for (const binding of manifest.bindings) {
      if (binding.target !== "typescript" && binding.target !== "python") {
        throw new Error("binding.target must be typescript or python");
      }
      if (!binding.source) throw new Error("binding.source is required");
      if (!binding.output) throw new Error("binding.output is required");
      const sourcePath = resolve(manifestDir, binding.source);
      const outputPath = resolve(manifestDir, binding.output);
      const source = await readFile(sourcePath, "utf8");
      const current = await readFile(outputPath, "utf8");
      const expected = binding.target === "typescript" ? generateTypeScriptBindings(source) : generatePythonBindings(source);
      if (current !== expected) {
        throw new Error(`generated bindings are out of date: ${outputPath}`);
      }
    }
  }
  if (manifest.examples !== undefined) {
    if (!Array.isArray(manifest.examples)) {
      throw new Error("examples must be an array");
    }
    for (const example of manifest.examples) {
      if (example.runtime !== "typescript" && example.runtime !== "python") {
        throw new Error("example.runtime must be typescript or python");
      }
      if (!example.path) throw new Error("example.path is required");
      await readFile(resolve(manifestDir, example.path));
    }
  }
  if (manifest.providerProfile !== undefined) {
    if (!manifest.providerProfile.endsWith(".json")) {
      throw new Error("providerProfile must point to a JSON file");
    }
    const profile = JSON.parse(await readFile(resolve(manifestDir, manifest.providerProfile), "utf8")) as ProviderProfile;
    validateProviderProfile(profile);
  }
  if (!manifest.compatibility || typeof manifest.compatibility !== "object") {
    throw new Error("compatibility policy is required");
  }
}

function validateProviderProfile(profile: ProviderProfile): void {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("provider profile must be a JSON object");
  }
  if (profile.provider !== "http-json" && profile.provider !== "openai-responses") {
    throw new Error("provider profile provider must be http-json or openai-responses");
  }
  if (profile.provider === "http-json" && typeof profile.endpoint !== "string") {
    throw new Error("provider profile endpoint is required for http-json");
  }
  if (typeof profile.model !== "string" || profile.model.length === 0) {
    throw new Error("provider profile model is required");
  }
  if (profile.apiKey !== undefined && typeof profile.apiKey !== "string") {
    throw new Error("provider profile apiKey must be a string");
  }
  if (profile.apiKeyEnv !== undefined && typeof profile.apiKeyEnv !== "string") {
    throw new Error("provider profile apiKeyEnv must be a string");
  }
  if (profile.responseFormat !== undefined && profile.responseFormat !== "json_schema" && profile.responseFormat !== "json_object") {
    throw new Error("provider profile responseFormat must be json_schema or json_object");
  }
  if (profile.temperature !== undefined && (typeof profile.temperature !== "number" || !Number.isFinite(profile.temperature))) {
    throw new Error("provider profile temperature must be a number");
  }
  if (profile.timeoutMs !== undefined && (typeof profile.timeoutMs !== "number" || !Number.isFinite(profile.timeoutMs) || profile.timeoutMs <= 0)) {
    throw new Error("provider profile timeoutMs must be a positive number");
  }
}

async function generateBindings(source: string, args: string[]): Promise<CliResult> {
  const target = optionValue(args, "--target");
  const outputPath = optionValue(args, "--output");
  const check = args.includes("--check");
  let generated: string;
  if (target === "typescript") {
    generated = generateTypeScriptBindings(source);
  } else if (target === "python") {
    generated = generatePythonBindings(source);
  } else {
    throw new Error("--target must be typescript or python");
  }
  if (check) {
    if (!outputPath) {
      throw new Error("--output is required for --check");
    }
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== generated) {
      return { exitCode: 1, stdout: "", stderr: `generated bindings are out of date: ${outputPath}\n` };
    }
    return { exitCode: 0, stdout: "ok\n", stderr: "" };
  }
  if (outputPath) {
    await writeFile(outputPath, generated, "utf8");
    return { exitCode: 0, stdout: "", stderr: "" };
  }
  return { exitCode: 0, stdout: generated, stderr: "" };
}

interface EvalReport {
  name: string;
  passed: boolean;
  metadata?: {
    provider: string;
    durationMs: number;
    contract?: EvalContract;
  };
  checks?: Array<{ name: string; passed: boolean }>;
}

interface EvalContract {
  source: string;
  sourceSha256: string;
  task: string;
  intent: string;
  input: Record<string, FormaField>;
  output: Record<string, FormaField>;
  schemas: Record<string, Record<string, FormaField>>;
  permissions: string[];
  verify: string[];
}

interface EvalSuiteArtifact {
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    settings?: EvalSettings;
  };
  reports: EvalReport[];
}

interface ReportComparison {
  name: string;
  passed: boolean;
  regressions: string[];
  improvements: string[];
  contractChanges?: string[];
  changes?: ChangeDetail[];
}

interface ChangeDetail {
  kind: "contract" | "setting";
  name?: string;
  field: string;
  severity: "breaking" | "review" | "environment";
  details?: FieldChangeDetails;
}

interface FieldChangeDetails {
  added?: string[];
  removed?: string[];
  changed?: string[];
}

async function compareReports(baselinePath: string, args: string[]): Promise<CliResult> {
  const candidatePath = args[0];
  if (!candidatePath) {
    return usage();
  }

  const baselineRaw = JSON.parse(await readFile(baselinePath, "utf8")) as EvalReport | EvalReport[] | EvalSuiteArtifact;
  const candidateRaw = JSON.parse(await readFile(candidatePath, "utf8")) as EvalReport | EvalReport[] | EvalSuiteArtifact;
  const baselineReports = normalizeReportFile(baselineRaw);
  const candidateReports = normalizeReportFile(candidateRaw);
  if (isSingleReportFile(baselineRaw) && isSingleReportFile(candidateRaw)) {
    const report = compareReport(baselineReports[0], candidateReports[0]);
    return {
      exitCode: report.passed ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  const baselineByName = new Map(baselineReports.map((report) => [report.name, report]));
  const candidateByName = new Map(candidateReports.map((report) => [report.name, report]));
  const names = Array.from(new Set([...baselineByName.keys(), ...candidateByName.keys()])).sort();
  const reports = names.map((name) => compareReport(baselineByName.get(name), candidateByName.get(name)));
  const regressions = reports.flatMap((report) => report.regressions.map((check) => `${report.name}:${check}`));
  const improvements = reports.flatMap((report) => report.improvements.map((check) => `${report.name}:${check}`));
  const contractChanges = reports.flatMap((report) => (report.contractChanges ?? []).map((field) => `${report.name}:${field}`));
  const settingChanges = compareSettings(summarySettings(baselineRaw), summarySettings(candidateRaw));
  const changes = [
    ...reports.flatMap((report) => (report.changes ?? []).map((change) => ({ ...change, name: report.name }))),
    ...settingChanges.map((field): ChangeDetail => ({ kind: "setting", field, severity: "environment" })),
  ];
  const failOn = failOnSeverities(args);
  const failedOn = Array.from(new Set(changes.filter((change) => failOn.has(change.severity)).map((change) => change.severity)));
  const report = {
    passed: reports.every((item) => item.passed) && regressions.length === 0 && failedOn.length === 0,
    regressions,
    improvements,
    ...(contractChanges.length > 0 ? { contractChanges } : {}),
    ...(settingChanges.length > 0 ? { settingChanges } : {}),
    ...(changes.length > 0 ? { changes } : {}),
    ...(failedOn.length > 0 ? { failedOn } : {}),
    reports,
  };

  return {
    exitCode: report.passed ? 0 : 1,
    stdout: `${JSON.stringify(report, null, 2)}\n`,
    stderr: "",
  };
}

function failOnSeverities(args: string[]): Set<ChangeDetail["severity"]> {
  const value = optionValue(args, "--fail-on");
  if (!value) return new Set();
  const severities = value.split(",").map((item) => item.trim()).filter(Boolean);
  for (const severity of severities) {
    if (severity !== "breaking" && severity !== "review" && severity !== "environment") {
      throw new Error("--fail-on must include breaking, review, or environment");
    }
  }
  return new Set(severities as Array<ChangeDetail["severity"]>);
}

function normalizeReportFile(report: EvalReport | EvalReport[] | EvalSuiteArtifact): EvalReport[] {
  if (Array.isArray(report)) return report;
  if ("reports" in report) return report.reports;
  return [report];
}

function isSingleReportFile(report: EvalReport | EvalReport[] | EvalSuiteArtifact): report is EvalReport {
  return !Array.isArray(report) && !("reports" in report);
}

function summarySettings(report: EvalReport | EvalReport[] | EvalSuiteArtifact): EvalSettings | undefined {
  return Array.isArray(report) || !("summary" in report) ? undefined : report.summary.settings;
}

function compareSettings(baseline: EvalSettings | undefined, candidate: EvalSettings | undefined): string[] {
  if (!baseline || !candidate) return [];
  const fields: Array<keyof EvalSettings> = ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"];
  return fields.filter((field) => baseline[field] !== candidate[field]);
}

function compareReport(baseline: EvalReport | undefined, candidate: EvalReport | undefined): ReportComparison {
  const baselineChecks = new Map((baseline?.checks ?? []).map((check) => [check.name, check.passed]));
  const candidateChecks = new Map((candidate?.checks ?? []).map((check) => [check.name, check.passed]));
  const names = Array.from(new Set([...baselineChecks.keys(), ...candidateChecks.keys()])).sort();
  const regressions = names.filter((name) => baselineChecks.get(name) === true && candidateChecks.get(name) !== true);
  const improvements = names.filter((name) => baselineChecks.get(name) !== true && candidateChecks.get(name) === true);
  const contractChanges = compareContracts(baseline?.metadata?.contract, candidate?.metadata?.contract);
  const changes = contractChanges.map((field): ChangeDetail => ({
    kind: "contract",
    field,
    severity: contractSeverity(field, baseline?.metadata?.contract, candidate?.metadata?.contract),
    ...contractChangeDetails(field, baseline?.metadata?.contract, candidate?.metadata?.contract),
  }));
  return {
    name: candidate?.name || baseline?.name || "unknown",
    passed: Boolean(candidate?.passed) && regressions.length === 0,
    regressions,
    improvements,
    ...(contractChanges.length > 0 ? { contractChanges } : {}),
    ...(changes.length > 0 ? { changes } : {}),
  };
}

function contractSeverity(field: string, baseline?: EvalContract, candidate?: EvalContract): ChangeDetail["severity"] {
  if (field === "output" && baseline && candidate && onlyAddsOptionalFields(baseline.output, candidate.output)) {
    return "review";
  }
  return field === "input" || field === "output" || field === "schemas" ? "breaking" : "review";
}

function onlyAddsOptionalFields(
  baseline: Record<string, FormaField>,
  candidate: Record<string, FormaField>,
): boolean {
  for (const [name, field] of Object.entries(baseline)) {
    if (!deepEqual(candidate[name], field)) return false;
  }
  const added = Object.keys(candidate).filter((name) => !(name in baseline));
  return added.length > 0 && added.every((name) => candidate[name]?.optional === true);
}

function contractChangeDetails(
  field: string,
  baseline: EvalContract | undefined,
  candidate: EvalContract | undefined,
): { details?: FieldChangeDetails } {
  if (!baseline || !candidate) return {};
  if (field === "input" || field === "output") {
    return optionalDetails(diffRecordFields(baseline[field], candidate[field]));
  }
  if (field === "schemas") {
    return optionalDetails(diffSchemas(baseline.schemas, candidate.schemas));
  }
  if (field === "permissions" || field === "verify") {
    return optionalDetails(diffStringList(baseline[field], candidate[field]));
  }
  return {};
}

function optionalDetails(details: FieldChangeDetails): { details?: FieldChangeDetails } {
  return Object.keys(details).length > 0 ? { details } : {};
}

function diffRecordFields(
  baseline: Record<string, FormaField>,
  candidate: Record<string, FormaField>,
  prefix = "",
): FieldChangeDetails {
  const names = Array.from(new Set([...Object.keys(baseline), ...Object.keys(candidate)])).sort();
  return collectDetails(names.map((name) => {
    const path = `${prefix}${name}`;
    if (!(name in baseline)) return { added: path };
    if (!(name in candidate)) return { removed: path };
    if (!deepEqual(baseline[name], candidate[name])) return { changed: path };
    return {};
  }));
}

function diffSchemas(
  baseline: Record<string, Record<string, FormaField>>,
  candidate: Record<string, Record<string, FormaField>>,
): FieldChangeDetails {
  const names = Array.from(new Set([...Object.keys(baseline), ...Object.keys(candidate)])).sort();
  return collectDetails(names.map((name) => {
    if (!(name in baseline)) return { added: name };
    if (!(name in candidate)) return { removed: name };
    return diffRecordFields(baseline[name]!, candidate[name]!, `${name}.`);
  }));
}

function diffStringList(baseline: string[], candidate: string[]): FieldChangeDetails {
  const baselineSet = new Set(baseline);
  const candidateSet = new Set(candidate);
  const added = candidate.filter((item) => !baselineSet.has(item)).sort();
  const removed = baseline.filter((item) => !candidateSet.has(item)).sort();
  return collectDetails([
    {
      ...(added.length > 0 ? { added } : {}),
      ...(removed.length > 0 ? { removed } : {}),
    },
  ]);
}

function collectDetails(items: Array<{ added?: string | string[]; removed?: string | string[]; changed?: string | string[] }>): FieldChangeDetails {
  const details: FieldChangeDetails = {};
  for (const item of items) {
    appendDetail(details, "added", item.added);
    appendDetail(details, "removed", item.removed);
    appendDetail(details, "changed", item.changed);
  }
  return details;
}

function appendDetail(details: FieldChangeDetails, key: keyof FieldChangeDetails, value: string | string[] | undefined): void {
  if (!value) return;
  details[key] = [...(details[key] ?? []), ...(Array.isArray(value) ? value : [value])];
}

function compareContracts(baseline: EvalContract | undefined, candidate: EvalContract | undefined): string[] {
  if (!baseline || !candidate) return [];
  const fields: Array<keyof EvalContract> = [
    "source",
    "sourceSha256",
    "task",
    "intent",
    "input",
    "output",
    "schemas",
    "permissions",
    "verify",
  ];
  return fields.filter((field) => !deepEqual(baseline[field], candidate[field]));
}

interface EvalFixture {
  name: string;
  source: string;
  input?: Record<string, FormaValue>;
  fakeProviderOutput?: Record<string, FormaValue>;
  expectedResult: Partial<Pick<FormaResult, "ok" | "output" | "trace" | "verification" | "error">>;
}

interface EvalSuite {
  fixtures: string[];
}

interface EvalOptions {
  provider: "fixture" | "http-json" | "openai-responses";
  endpoint?: string;
  model?: string;
  apiKey?: string;
  responseFormat?: "json_schema" | "json_object";
  temperature?: number;
  timeoutMs?: number;
}

interface ProviderProfile {
  provider?: string;
  endpoint?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  responseFormat?: "json_schema" | "json_object";
  temperature?: number;
  timeoutMs?: number;
}

interface EvalSettings {
  provider: EvalOptions["provider"];
  endpoint?: string;
  model?: string;
  responseFormat?: "json_schema" | "json_object";
  temperature?: number;
  timeoutMs?: number;
}

async function evaluateFixture(path: string, args: string[]): Promise<CliResult> {
  const evalOptions = await parseEvalOptions(args);
  const tools = createCliTools(args);
  const report = await evaluateFixtureReport(path, evalOptions, tools);
  return {
    exitCode: report.passed ? 0 : 1,
    stdout: `${JSON.stringify(report, null, 2)}\n`,
    stderr: "",
  };
}

async function evaluateSuite(path: string, args: string[]): Promise<CliResult> {
  const suite = JSON.parse(await readFile(path, "utf8")) as EvalSuite;
  const evalOptions = await parseEvalOptions(args);
  const tools = createCliTools(args);
  const startedAt = Date.now();
  const reports = await Promise.all(
    suite.fixtures.map((fixturePath) => evaluateFixtureReport(resolve(dirname(path), fixturePath), evalOptions, tools)),
  );
  const passed = reports.every((report) => report.passed);
  if (args.includes("--summary")) {
    const artifact: EvalSuiteArtifact = {
      passed,
      summary: {
        total: reports.length,
        passed: reports.filter((report) => report.passed).length,
        failed: reports.filter((report) => !report.passed).length,
        durationMs: Date.now() - startedAt,
        settings: evalSettings(evalOptions),
      },
      reports,
    };
    return {
      exitCode: passed ? 0 : 1,
      stdout: `${JSON.stringify(artifact, null, 2)}\n`,
      stderr: "",
    };
  }
  return {
    exitCode: passed ? 0 : 1,
    stdout: `${JSON.stringify(reports, null, 2)}\n`,
    stderr: "",
  };
}

function evalSettings(options: EvalOptions): EvalSettings {
  return {
    provider: options.provider,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.model ? { model: options.model } : {}),
    ...(options.responseFormat ? { responseFormat: options.responseFormat } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  };
}

async function evaluateFixtureReport(path: string, evalOptions: EvalOptions, tools?: ToolHost) {
  const fixture = JSON.parse(await readFile(path, "utf8")) as EvalFixture;
  const sourcePath = resolve(dirname(path), fixture.source);
  const source = await readFile(sourcePath, "utf8");
  const task = parseForma(source).tasks.find((candidate) => candidate.name === fixture.name);
  if (!task) throw new Error(`task not found in fixture source: ${fixture.name}`);
  const modelProvider = createEvalProvider(fixture, evalOptions);
  const runtimeOptions: { modelProvider?: ModelProvider; tools?: ToolHost } = {};
  if (modelProvider) runtimeOptions.modelProvider = modelProvider;
  if (tools) runtimeOptions.tools = tools;
  const runtime = new FormaRuntime(runtimeOptions);
  const startedAt = Date.now();
  const result = await runtime.runTask(source, fixture.name, {
    input: fixture.input ?? {},
    sourceName: sourcePath,
  });
  const durationMs = Date.now() - startedAt;
  const checks = [
    { name: "ok", passed: result.ok === fixture.expectedResult.ok },
    { name: "output", passed: deepEqual(result.output, fixture.expectedResult.output ?? {}) },
    { name: "trace", passed: deepEqual(result.trace, fixture.expectedResult.trace ?? []) },
    { name: "verification", passed: deepEqual(result.verification, normalizeVerification(fixture.expectedResult.verification)) },
    { name: "error", passed: result.error === (fixture.expectedResult.error ?? null) },
  ];
  const report = {
    name: fixture.name,
    passed: checks.every((check) => check.passed),
    result,
    metadata: {
      provider: providerName(fixture, evalOptions),
      durationMs,
      contract: contractSummary(task, sourcePath, source),
    },
    checks,
  };
  return report;
}

function contractSummary(task: FormaTask, sourcePath: string, source: string): EvalContract {
  return {
    source: sourcePath,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    task: task.name,
    intent: task.intent,
    input: task.input,
    output: task.output,
    schemas: task.schemas,
    permissions: task.permissions,
    verify: task.verify,
  };
}

async function parseEvalOptions(args: string[]): Promise<EvalOptions> {
  const profile = await loadProviderProfile(args);
  const provider = optionValue(args, "--provider") ?? profile.provider;
  if (!provider) return { provider: "fixture" };
  if (provider !== "http-json" && provider !== "openai-responses") {
    throw new Error(`unsupported eval provider '${provider}'`);
  }
  const model = optionValue(args, "--model") ?? profile.model ?? (provider === "openai-responses" ? process.env.OPENAI_MODEL : undefined);
  if (!model) throw new Error(`--model is required for --provider ${provider}`);
  const apiKey = optionValue(args, "--api-key")
    ?? (profile.apiKeyEnv ? process.env[profile.apiKeyEnv] : undefined)
    ?? profile.apiKey
    ?? (provider === "openai-responses" ? process.env.OPENAI_API_KEY : undefined);
  if (provider === "openai-responses" && !apiKey) {
    throw new Error("--api-key is required for --provider openai-responses");
  }
  const endpoint = optionValue(args, "--endpoint") ?? profile.endpoint;
  if (provider === "http-json" && !endpoint) {
    throw new Error("--endpoint is required for --provider http-json");
  }
  const responseFormat = responseFormatOption(args) ?? profile.responseFormat;
  const temperature = numericOption(args, "--temperature") ?? profile.temperature;
  const timeoutMs = numericOption(args, "--timeout-ms") ?? profile.timeoutMs;
  return {
    provider,
    ...(endpoint ? { endpoint } : {}),
    model,
    ...(apiKey ? { apiKey } : {}),
    ...(responseFormat ? { responseFormat } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

async function loadProviderProfile(args: string[]): Promise<ProviderProfile> {
  const profilePath = optionValue(args, "--provider-profile");
  if (!profilePath) return {};
  const parsed = JSON.parse(await readFile(profilePath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--provider-profile must contain a JSON object");
  }
  return parsed as ProviderProfile;
}

function createEvalProvider(fixture: EvalFixture, options: EvalOptions): ModelProvider | undefined {
  if (options.provider === "fixture") {
    return fixture.fakeProviderOutput ? new StaticProvider(fixture.fakeProviderOutput) : undefined;
  }
  return createConfiguredProvider(options);
}

function createConfiguredProvider(options: EvalOptions): ModelProvider {
  if (options.provider === "http-json") {
    return new HttpJsonProvider({
      endpoint: options.endpoint ?? "",
      model: options.model ?? "",
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.responseFormat ? { responseFormat: options.responseFormat } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
  }
  if (options.provider === "openai-responses") {
    return new OpenAIResponsesProvider({
      model: options.model ?? "",
      apiKey: options.apiKey ?? "",
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.responseFormat ? { responseFormat: options.responseFormat } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
  }
  throw new Error(`unsupported eval provider '${options.provider}'`);
}

function createCliTools(args: string[]): ToolHost | undefined {
  const workspaceRoot = resolve(optionValue(args, "--workspace") ?? process.cwd());
  const allowedTestCommands = optionValues(args, "--allow-test-command");
  const tools: ToolHost = {};
  if (args.includes("--allow-read")) {
    tools.readText = async (path) => readFile(resolveWorkspacePath(workspaceRoot, path), "utf8");
  }
  if (args.includes("--allow-search")) {
    tools.searchText = async (query) => searchFiles(workspaceRoot, query);
  }
  if (args.includes("--allow-test")) {
    tools.runTest = async (command) => {
      if (allowedTestCommands.length > 0 && !allowedTestCommands.includes(command)) {
        throw new Error(`test command is not allowed: ${command}`);
      }
      try {
        const result = await execAsync(command, { cwd: workspaceRoot });
        return { ok: true, output: `${result.stdout}${result.stderr}` };
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string };
        return { ok: false, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
      }
    };
  }
  if (args.includes("--allow-edit")) {
    tools.writeText = async (path, content) => {
      await writeFile(resolveWorkspacePath(workspaceRoot, path), content, "utf8");
      return { ok: true, output: "" };
    };
  }
  return Object.keys(tools).length > 0 ? tools : undefined;
}

function resolveWorkspacePath(workspaceRoot: string, path: string): string {
  const resolved = resolve(workspaceRoot, path);
  const local = relative(workspaceRoot, resolved);
  if (local === "") {
    return resolved;
  }
  if (local === ".." || local.startsWith("../") || local.startsWith("..\\") || isAbsolute(local)) {
    throw new Error(`path is outside workspace: ${path}`);
  }
  return resolved;
}

async function searchFiles(root: string, query: string): Promise<string[]> {
  const matches: string[] = [];
  async function visit(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
        continue;
      }
      if (!entry.isFile()) continue;
      const text = await readFile(child, "utf8").catch(() => "");
      if (text.includes(query)) {
        matches.push(child);
      }
    }
  }
  await visit(root);
  return matches;
}

function providerName(fixture: EvalFixture, options: EvalOptions): string {
  if (options.provider === "http-json") return "http-json";
  if (options.provider === "openai-responses") return "openai-responses";
  return fixture.fakeProviderOutput ? "static" : "none";
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function optionValues(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === name && value) {
      values.push(value);
    }
  }
  return values;
}

function numericOption(args: string[], name: string): number | undefined {
  const value = optionValue(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  if (name === "--timeout-ms" && parsed <= 0) {
    throw new Error("--timeout-ms must be positive");
  }
  return parsed;
}

function responseFormatOption(args: string[]): "json_schema" | "json_object" | undefined {
  const value = optionValue(args, "--response-format");
  if (value === undefined) return undefined;
  if (value !== "json_schema" && value !== "json_object") {
    throw new Error("--response-format must be json_schema or json_object");
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeVerification(verification: FormaResult["verification"] | undefined): FormaResult["verification"] {
  return { ok: verification?.ok ?? false, failures: verification?.failures ?? [] };
}

function parseInput(args: string[]): Record<string, FormaValue> {
  const index = args.indexOf("--input");
  if (index === -1) return {};

  const raw = args[index + 1];
  if (!raw) {
    throw new Error("--input requires JSON");
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--input must be a JSON object");
  }

  return parsed as Record<string, FormaValue>;
}

function formatDiagnostics(diagnostics: FormaDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.source}:${diagnostic.start.line}:${diagnostic.start.column}: ${diagnostic.code}: ${diagnostic.message}`)
    .join("\n")
    .concat("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
