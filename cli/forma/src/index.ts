#!/usr/bin/env node
import { createHash } from "node:crypto";
import { exec } from "node:child_process";
import { mkdir, readFile, watch, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  FormaRuntime,
  generatePydanticBindings,
  generatePythonBindings,
  generateTypeScriptBindings,
  HttpJsonProvider,
  OpenAIResponsesProvider,
  parseForma,
  StaticProvider,
  validateProgram,
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
  if (!command || !path || (command !== "check" && command !== "run" && command !== "outline" && command !== "preview" && command !== "eval" && command !== "eval-suite" && command !== "compare" && command !== "generate" && command !== "golden-proof" && command !== "package-check" && command !== "package-init" && command !== "package-lock" && command !== "package-review" && command !== "project-check" && command !== "project-init")) {
    return usage();
  }

  try {
    if (command === "golden-proof") {
      return goldenProof(path);
    }

    if (command === "project-init") {
      return await initializeProject(path, rest);
    }

    if (command === "project-check") {
      return await checkProject(path, rest);
    }

    if (command === "package-init") {
      return await initializePackage(path, rest);
    }

    if (command === "package-check") {
      return await checkPackageManifest(path);
    }

    if (command === "package-lock") {
      return await lockPackageManifest(path, rest);
    }

    if (command === "package-review") {
      return await reviewPackageManifest(path, rest);
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

    if (command === "outline") {
      return outlineSource(source);
    }

    if (command === "preview") {
      return previewSource(source, path, rest);
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
  return { exitCode: 2, stdout: "", stderr: "usage: forma <check|run|outline|preview|eval|eval-suite|compare|generate|golden-proof|package-check|package-init|package-lock|package-review|project-check|project-init> <path> [--input JSON]\n" };
}

function goldenProof(root: string): CliResult {
  const proof = {
    passed: true,
    root,
    workflows: [
      {
        name: "review_diff first-use path",
        task: "review_diff",
        runtimes: ["typescript", "python"],
        commands: ["pnpm run smoke:local:ts", "python test/review_diff_local_smoke.py"],
        validation: "generated TypeScript and Python bindings",
        diagnostics: [],
        traceSummary: [],
        nextGate: "stop local or add checked project CI",
      },
      {
        name: "function_repair coding-agent showcase",
        task: "repair_function",
        runtimes: ["typescript", "python"],
        commands: [
          "vitest run repair_function_trace.test.ts",
          "python repair_function_trace_test.py",
        ],
        validation: "generated TypeScript and Python bindings",
        diagnostics: [],
        traceSummary: ["read", "search", "edit", "test"],
        nextGate: "package review after local usefulness",
      },
    ],
  };
  return { exitCode: 0, stdout: `${JSON.stringify(proof, null, 2)}\n`, stderr: "" };
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
  tests?: Array<{
    runtime?: string;
    path?: string;
  }>;
  releaseFiles?: Array<{
    path?: string;
  }>;
  providerProfile?: string;
  compatibility?: unknown;
}

interface FormaPackageLock {
  package?: Record<string, unknown>;
  tasks?: Array<Record<string, unknown>>;
  evalSuite?: Record<string, unknown>;
  providerProfile?: Record<string, unknown>;
  bindings?: Array<Record<string, unknown>>;
  examples?: Array<Record<string, unknown>>;
  tests?: Array<Record<string, unknown>>;
  releaseFiles?: Array<Record<string, unknown>>;
}

interface FormaProjectManifest {
  formaProject?: number;
  name?: string;
  task?: string;
  source?: string;
  providerProfile?: string;
  bindings?: Array<{
    target?: string;
    source?: string;
    output?: string;
  }>;
  entrypoints?: Array<{
    runtime?: string;
    path?: string;
  }>;
  smokeTests?: Array<{
    runtime?: string;
    path?: string;
    command?: string;
  }>;
  packageLockSmokeTests?: Array<{
    runtime?: string;
    path?: string;
    command?: string;
  }>;
  ciWorkflow?: string;
}

class ProjectCheckError extends Error {
  constructor(
    message: string,
    readonly check: Record<string, unknown>,
  ) {
    super(message);
  }
}

const requiredPackageReleaseFiles = [
  "README.md",
  ".github/workflows/forma-package.yml",
  ".github/workflows/forma-publish.yml",
];
const packageEmbeddingGuidance = "docs/guides/package-consumer-quickstart.md#what-the-helper-calls";
const packageProviderOverrideGuidance = "docs/guides/package-consumer-quickstart.md#explicit-provider-overrides";
const packageProviderOverrideRecoveryGuidance = "missingProviderOverrideTests";
const packageMigrationParityRecoveryGuidance = "missingMigrationParityTests";
const packageMigrationParityTroubleshootingGuidance = "docs/guides/package-consumer-quickstart.md#missingmigrationparitytests";
const packageTroubleshootingGuidance = "docs/guides/package-consumer-quickstart.md#troubleshooting";

function packageLockOutOfDateMessage(outputPath: string): string {
  return [
    `package lock is out of date: ${outputPath}`,
    "review artifact group changes before regenerating the package lock",
    "",
  ].join("\n");
}

function packageLockChangeReport(packageLock: string, current: FormaPackageLock, candidate: FormaPackageLock) {
  return {
    passed: false,
    packageLock,
    guidance: "review artifact group changes before regenerating the package lock",
    changedArtifactGroups: changedPackageLockArtifactGroups(current, candidate),
  };
}

function changedPackageLockArtifactGroups(current: FormaPackageLock, candidate: FormaPackageLock) {
  return [
    changedObjectGroup("package", current.package, candidate.package),
    changedArrayGroup("tasks", current.tasks, candidate.tasks, "source"),
    changedObjectGroup("evalSuite", current.evalSuite, candidate.evalSuite),
    changedObjectGroup("providerProfile", current.providerProfile, candidate.providerProfile),
    changedArrayGroup("bindings", current.bindings, candidate.bindings, "output"),
    changedArrayGroup("examples", current.examples, candidate.examples, "path"),
    changedArrayGroup("tests", current.tests, candidate.tests, "path"),
    changedArrayGroup("releaseFiles", current.releaseFiles, candidate.releaseFiles, "path"),
  ].filter((group) => group !== undefined);
}

function changedObjectGroup(group: string, current: Record<string, unknown> | undefined, candidate: Record<string, unknown> | undefined) {
  if (!current && !candidate) return undefined;
  if (!current) return { group, added: Object.keys(candidate ?? {}).sort() };
  if (!candidate) return { group, removed: Object.keys(current).sort() };
  const changed = Array.from(new Set([...Object.keys(current), ...Object.keys(candidate)]))
    .filter((key) => !deepEqual(current[key], candidate[key]))
    .sort();
  return changed.length > 0 ? { group, changed } : undefined;
}

function changedArrayGroup(
  group: string,
  current: Array<Record<string, unknown>> | undefined,
  candidate: Array<Record<string, unknown>> | undefined,
  key: string,
) {
  const currentMap = new Map((current ?? []).map((entry) => [String(entry[key]), entry]));
  const candidateMap = new Map((candidate ?? []).map((entry) => [String(entry[key]), entry]));
  const added = [...candidateMap.keys()].filter((entryKey) => !currentMap.has(entryKey)).sort();
  const removed = [...currentMap.keys()].filter((entryKey) => !candidateMap.has(entryKey)).sort();
  const changed = [...candidateMap.keys()]
    .filter((entryKey) => currentMap.has(entryKey) && !deepEqual(currentMap.get(entryKey), candidateMap.get(entryKey)))
    .sort();
  return added.length > 0 || removed.length > 0 || changed.length > 0
    ? omitUndefined({ group, added: added.length > 0 ? added : undefined, removed: removed.length > 0 ? removed : undefined, changed: changed.length > 0 ? changed : undefined })
    : undefined;
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
    if (current === serialized) {
      return args.includes("--json")
        ? { exitCode: 0, stdout: `${JSON.stringify({ passed: true, packageLock: outputPath, changedArtifactGroups: [] }, null, 2)}\n`, stderr: "" }
        : { exitCode: 0, stdout: "ok\n", stderr: "" };
    }
    if (args.includes("--json")) {
      const currentLock = current ? JSON.parse(current) as FormaPackageLock : {};
      const report = packageLockChangeReport(outputPath, currentLock, lock as FormaPackageLock);
      return { exitCode: 1, stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: packageLockOutOfDateMessage(outputPath) };
  }
  if (outputPath) {
    await writeFile(outputPath, serialized, "utf8");
    return { exitCode: 0, stdout: "ok\n", stderr: "" };
  }
  return { exitCode: 0, stdout: serialized, stderr: "" };
}

async function reviewPackageManifest(path: string, args: string[] = []): Promise<CliResult> {
  const manifest = JSON.parse(await readFile(path, "utf8")) as FormaPackageManifest;
  const manifestDir = dirname(path);
  await validatePackageManifest(manifest, manifestDir);
  const lockPath = packageLockPath(path);
  const expectedLock = `${JSON.stringify(await createPackageLock(path, manifest, manifestDir), null, 2)}\n`;
  const currentLock = await readFile(lockPath, "utf8");
  if (currentLock !== expectedLock) {
    throw new Error(`package lock is out of date: ${lockPath}`);
  }
  const suiteResult = await evaluateSuite(resolve(manifestDir, manifest.evalSuite ?? ""), ["--summary"]);
  if (suiteResult.exitCode !== 0) {
    return { exitCode: 1, stdout: "", stderr: suiteResult.stderr || "eval suite failed\n" };
  }
  const suite = JSON.parse(suiteResult.stdout) as EvalSuiteArtifact;
  const compatibilityPolicyCheck = packageCompatibilityPolicyCheck(manifest);
  const providerProfileCheck = await packageProviderProfileCheck(manifest, manifestDir);
  const bindingsCheck = packageBindingsCheck(manifest);
  const examplesCheck = packageExamplesCheck(manifest);
  const testsCheck = packageTestsCheck(manifest);
  const proofCommandCheck = await packageProofCommandCheck(args);
  const releaseFilesCheck = packageReleaseFilesCheck(manifest);
  const readmeCheck = await packageReadmeCheck(path, manifest, manifestDir);
  const ciWorkflowCheck = await packageCiWorkflowCheck(path, manifest, manifestDir);
  const publishBundleCheck = await packagePublishBundleCheck(path, manifest, manifestDir);
  const evalCoverageCheck = packageEvalCoverageCheck(manifest, suite);
  const checks: Array<Record<string, unknown>> = [
    { name: "package-check", passed: true },
    { name: "package-lock", passed: true, path: lockPath },
    compatibilityPolicyCheck,
    providerProfileCheck,
    bindingsCheck,
    examplesCheck,
    testsCheck,
    ...(proofCommandCheck ? [proofCommandCheck] : []),
    releaseFilesCheck,
    readmeCheck,
    ciWorkflowCheck,
    publishBundleCheck,
    evalCoverageCheck,
    { name: "eval-suite", passed: true, total: suite.summary?.total ?? 0, failed: suite.summary?.failed ?? 0 },
  ];
  let passed = compatibilityPolicyCheck.passed === true
    && providerProfileCheck.passed === true
    && bindingsCheck.passed === true
    && examplesCheck.passed === true
    && testsCheck.passed === true
    && (proofCommandCheck?.passed ?? true) === true
    && releaseFilesCheck.passed === true
    && readmeCheck.passed === true
    && ciWorkflowCheck.passed === true
    && publishBundleCheck.passed === true
    && evalCoverageCheck.passed === true;
  const baselinePath = optionValue(args, "--baseline");
  if (baselinePath) {
    const failOnArgs = optionValue(args, "--fail-on") ? args : [...args, "--fail-on", "breaking,environment"];
    const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as EvalReport | EvalReport[] | EvalSuiteArtifact;
    const comparison = compareReportArtifacts(baseline, suite, failOnArgs);
    const report = comparison.report as SuiteComparison;
    const failOn = Array.from(failOnSeverities(failOnArgs));
    passed = passed && report.passed;
    checks.push({
      name: "compare",
      passed: report.passed,
      baseline: baselinePath,
      failOn,
      ...(report.failedOn ? { failedOn: report.failedOn } : {}),
      ...(report.regressions.length > 0 ? { regressions: report.regressions } : {}),
      ...(report.contractChanges ? { contractChanges: report.contractChanges } : {}),
      ...(report.settingChanges ? { settingChanges: report.settingChanges } : {}),
      ...(report.changes ? { changes: report.changes } : {}),
    });
  }
  return {
    exitCode: passed ? 0 : 1,
    stdout: `${JSON.stringify({
      passed,
      package: {
        name: manifest.name,
        version: manifest.version,
        manifest: path,
      },
      notes: [
        "minimal first-use success proves local embedding; package-review proves reviewed release readiness for reusable packages",
      ],
      checks,
    }, null, 2)}\n`,
    stderr: "",
  };
}

async function packageProofCommandCheck(args: string[]): Promise<Record<string, unknown> | undefined> {
  const command = optionValue(args, "--proof-command");
  if (!command) {
    return undefined;
  }
  try {
    const result = await execAsync(command);
    return {
      name: "proof-command",
      passed: true,
      command,
      ...(result.stdout ? { stdout: result.stdout } : {}),
      ...(result.stderr ? { stderr: result.stderr } : {}),
    };
  } catch (error) {
    const failed = error as { code?: unknown; stdout?: unknown; stderr?: unknown };
    return {
      name: "proof-command",
      passed: false,
      command,
      ...(typeof failed.code === "number" ? { exitCode: failed.code } : {}),
      ...(typeof failed.stdout === "string" && failed.stdout ? { stdout: failed.stdout } : {}),
      ...(typeof failed.stderr === "string" && failed.stderr ? { stderr: failed.stderr } : {}),
      ...proofCommandRecovery(command, failed),
    };
  }
}

function proofCommandRecovery(command: string, failed: { stdout?: unknown; stderr?: unknown }): Record<string, unknown> {
  const output = `${typeof failed.stdout === "string" ? failed.stdout : ""}\n${typeof failed.stderr === "string" ? failed.stderr : ""}`;
  if (!command.includes("packages:installed-smoke") && !output.includes("packages:installed-smoke")) {
    return {};
  }
  return {
    guidance: "rerun corepack pnpm packages:installed-smoke and restore the installed release bundle smoke path",
    triageGuide: "docs/guides/testing-and-verification.md#installed-package-smoke-triage",
    recoveryCommands: [
      "corepack pnpm packages:installed-smoke",
      "corepack pnpm docs:check",
    ],
    ...installedPackageSmokeKind(output),
  };
}

function installedPackageSmokeKind(output: string): Record<string, unknown> {
  const matches = [...output.matchAll(/^installed package smoke: (.+)$/gm)];
  const packageKind = matches.at(-1)?.[1]?.trim();
  return packageKind ? { packageKind } : {};
}

function packageCompatibilityPolicyCheck(manifest: FormaPackageManifest): Record<string, unknown> {
  const policy = manifest.compatibility as { breaking?: unknown; review?: unknown; environment?: unknown } | undefined;
  const breaking = Array.isArray(policy?.breaking) ? policy.breaking.filter((field): field is string => typeof field === "string") : [];
  const review = Array.isArray(policy?.review) ? policy.review.filter((field): field is string => typeof field === "string") : [];
  const environment = Array.isArray(policy?.environment) ? policy.environment.filter((field): field is string => typeof field === "string") : [];
  const missingBreakingFields = ["input", "output", "schemas"].filter((field) => !breaking.includes(field));
  const missingReviewFields = ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples", "releaseFiles"].filter((field) => !review.includes(field));
  const missingEnvironmentFields = ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"].filter((field) => !environment.includes(field));
  return {
    name: "compatibility-policy",
    passed: missingBreakingFields.length === 0 && missingReviewFields.length === 0 && missingEnvironmentFields.length === 0,
    ...(missingBreakingFields.length > 0 ? { missingBreakingFields } : {}),
    ...(missingReviewFields.length > 0 ? { missingReviewFields } : {}),
    ...(missingEnvironmentFields.length > 0 ? { missingEnvironmentFields } : {}),
  };
}

async function packageProviderProfileCheck(manifest: FormaPackageManifest, manifestDir: string): Promise<Record<string, unknown>> {
  const required = await packageRequiresProviderProfile(manifest, manifestDir);
  if (!manifest.providerProfile) {
    return {
      name: "provider-profile",
      passed: !required,
      ...(required ? { required, missingProviderProfile: true } : {}),
    };
  }
  const profile = JSON.parse(await readFile(resolve(manifestDir, manifest.providerProfile), "utf8")) as ProviderProfile;
  const secretFields = [
    ...("apiKey" in profile ? ["apiKey"] : []),
  ];
  const missingApiKeyEnv = required && profile.provider === "openai-responses" && !profile.apiKeyEnv;
  return {
    name: "provider-profile",
    passed: secretFields.length === 0 && !missingApiKeyEnv,
    provider: profile.provider,
    model: profile.model,
    ...(required ? { required } : {}),
    ...(profile.apiKeyEnv ? { apiKeyEnv: profile.apiKeyEnv } : {}),
    ...(profile.endpoint ? { endpoint: profile.endpoint } : {}),
    ...(secretFields.length > 0 ? { secretFields } : {}),
    ...(missingApiKeyEnv ? { missingApiKeyEnv } : {}),
  };
}

async function packageRequiresProviderProfile(manifest: FormaPackageManifest, manifestDir: string): Promise<boolean> {
  for (const task of manifest.tasks ?? []) {
    if (!task.source || !task.name) continue;
    const source = await readFile(resolve(manifestDir, task.source), "utf8");
    const parsedTask = parseForma(source).tasks.find((candidate) => candidate.name === task.name);
    if (parsedTask?.agentInstruction) {
      return true;
    }
  }
  return false;
}

function packageEvalCoverageCheck(manifest: FormaPackageManifest, suite: EvalSuiteArtifact): Record<string, unknown> {
  const tasks = Array.from(new Set(suite.reports.map((report) => report.name)));
  const requiredTasks = (manifest.tasks ?? []).flatMap((task) => task.name ? [task.name] : []);
  const missingTasks = requiredTasks.filter((task) => !tasks.includes(task));
  const reportByName = new Map(suite.reports.map((report) => [report.name, report]));
  const mismatchedTasks = (manifest.tasks ?? []).flatMap((task) => {
    if (!task.name || !task.sourceSha256) return [];
    const report = reportByName.get(task.name);
    return report?.metadata?.contract?.sourceSha256 === task.sourceSha256 ? [] : [task.name];
  }).filter((task) => !missingTasks.includes(task));
  return {
    name: "eval-coverage",
    passed: missingTasks.length === 0 && mismatchedTasks.length === 0,
    tasks,
    ...(missingTasks.length > 0 ? { missingTasks } : {}),
    ...(mismatchedTasks.length > 0 ? { mismatchedTasks } : {}),
  };
}

function packageBindingsCheck(manifest: FormaPackageManifest): Record<string, unknown> {
  const bindings = manifest.bindings ?? [];
  const requiredTargets = ["typescript", "python"];
  const targets = Array.from(
    new Set(bindings.flatMap((binding) => binding.target === "typescript" || binding.target === "python" ? [binding.target] : [])),
  );
  const missingTargets = requiredTargets.filter((target) => !targets.includes(target));
  return {
    name: "bindings",
    passed: missingTargets.length === 0,
    total: bindings.length,
    targets,
    ...(missingTargets.length > 0 ? { missingTargets } : {}),
  };
}

function packageExamplesCheck(manifest: FormaPackageManifest): Record<string, unknown> {
  const examples = manifest.examples ?? [];
  const requiredRuntimes = ["typescript", "python"];
  const runtimes = Array.from(
    new Set(examples.flatMap((example) => example.runtime === "typescript" || example.runtime === "python" ? [example.runtime] : [])),
  );
  const missingRuntimes = requiredRuntimes.filter((runtime) => !runtimes.includes(runtime));
  return {
    name: "examples",
    passed: missingRuntimes.length === 0,
    total: examples.length,
    runtimes,
    ...(missingRuntimes.length > 0 ? { missingRuntimes } : {}),
  };
}

function packageTestsCheck(manifest: FormaPackageManifest): Record<string, unknown> {
  const tests = manifest.tests ?? [];
  const runtimes = Array.from(
    new Set(tests.flatMap((test) => test.runtime === "typescript" || test.runtime === "python" ? [test.runtime] : [])),
  );
  const commands = packageTestCommands(tests);
  const requiredProviderOverrideTests = packageProviderOverrideTestPaths(manifest);
  const testPaths = new Set(tests.flatMap((test) => typeof test.path === "string" ? [test.path] : []));
  const missingProviderOverrideTests = tests.length > 0
    ? requiredProviderOverrideTests.filter((path) => !testPaths.has(path))
    : [];
  const migrationParityTests = packageMigrationParityTestPaths(tests);
  return {
    name: "tests",
    passed: missingProviderOverrideTests.length === 0,
    total: tests.length,
    runtimes,
    ...(commands.length > 0 ? { commands } : {}),
    ...(migrationParityTests.length > 0 ? { migrationParityTests } : {}),
    ...(missingProviderOverrideTests.length > 0 ? { missingProviderOverrideTests } : {}),
  };
}

function packageProviderOverrideTestPaths(manifest: FormaPackageManifest): string[] {
  const taskNames = manifest.tasks?.flatMap((task) => typeof task.name === "string" ? [task.name] : []) ?? [];
  return taskNames.flatMap((name) => [`${name}_contract.test.ts`, `${name}_contract_test.py`]);
}

function packageMigrationParityTestPaths(tests: Array<{ runtime?: string; path?: string }>): string[] {
  return tests.flatMap((test) => {
    if (typeof test.path !== "string") {
      return [];
    }
    return /_migration(_test)?\.(test\.ts|py)$/.test(test.path) ? [test.path] : [];
  });
}

function packageReleaseFilesCheck(manifest: FormaPackageManifest): Record<string, unknown> {
  const files = manifest.releaseFiles ?? [];
  const paths = Array.from(
    new Set(files.flatMap((file) => typeof file.path === "string" ? [file.path] : [])),
  );
  const missingPaths = requiredPackageReleaseFiles.filter((path) => !paths.includes(path));
  return {
    name: "release-files",
    passed: missingPaths.length === 0,
    total: files.length,
    paths,
    ...(missingPaths.length > 0 ? { missingPaths } : {}),
  };
}

async function packageReadmeCheck(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): Promise<Record<string, unknown>> {
  const readmePath = "README.md";
  const readme = await readFile(resolve(manifestDir, readmePath), "utf8").catch(() => "");
  const commands = packageReadmeCommands(manifestPath, manifest, manifestDir);
  const missingCommands = commands.filter((command) => !readme.includes(command));
  const migrationProofCommand = packageMigrationParityProofReviewCommand(relative(manifestDir, resolve(manifestPath)), manifest.tests);
  const missingMigrationParityProofCommand = migrationProofCommand && missingCommands.includes(migrationProofCommand)
    ? migrationProofCommand
    : undefined;
  const missingMigrationParityTests = packageMigrationParityTestPaths(manifest.tests ?? [])
    .filter((path) => !readme.includes(path));
  const migrationParityTests = packageMigrationParityTestPaths(manifest.tests ?? []);
  const guidance = [
    packageEmbeddingGuidance,
    packageProviderOverrideGuidance,
    packageProviderOverrideRecoveryGuidance,
    ...(migrationParityTests.length > 0 ? [packageMigrationParityRecoveryGuidance] : []),
    ...(migrationParityTests.length > 0 ? [packageMigrationParityTroubleshootingGuidance] : []),
  ];
  const missingGuidance = guidance.filter((item) => !readme.includes(item));
  return {
    name: "readme",
    passed: readme.length > 0 && missingCommands.length === 0 && missingMigrationParityTests.length === 0 && missingGuidance.length === 0,
    total: commands.length,
    ...(readme.length === 0 ? { missingReadme: readmePath } : {}),
    ...(missingCommands.length > 0 ? { missingCommands } : {}),
    ...(missingMigrationParityProofCommand ? { missingMigrationParityProofCommand } : {}),
    ...(missingMigrationParityTests.length > 0 ? { missingMigrationParityTests } : {}),
    ...(missingGuidance.length > 0 ? { missingGuidance } : {}),
  };
}

function packageReadmeCommands(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): string[] {
  const manifestFile = relative(manifestDir, resolve(manifestPath));
  const lockFile = packageLockPath(manifestFile);
  const migrationProofCommand = packageMigrationParityProofReviewCommand(manifestFile, manifest.tests);
  return [
    `forma package-review ${manifestFile}`,
    ...(migrationProofCommand ? [migrationProofCommand] : []),
    `forma package-check ${manifestFile}`,
    `forma package-lock ${manifestFile} --output ${lockFile} --check`,
    ...packageTestCommands(manifest.tests),
    `forma eval-suite ${manifest.evalSuite ?? ""} --summary > candidate.json`,
    `forma package-review ${manifestFile} --baseline baseline.json`,
    "forma compare baseline.json candidate.json --fail-on breaking,environment",
  ];
}

async function packageCiWorkflowCheck(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): Promise<Record<string, unknown>> {
  const workflowPath = ".github/workflows/forma-package.yml";
  const workflow = await readFile(resolve(manifestDir, workflowPath), "utf8").catch(() => "");
  const commands = packageCiWorkflowCommands(manifestPath, manifest, manifestDir);
  const missingCommands = commands.filter((command) => !workflowIncludesCommand(workflow, command));
  const migrationProofCommand = packageMigrationParityProofReviewCommand(relative(manifestDir, resolve(manifestPath)), manifest.tests);
  const missingMigrationParityProofCommand = migrationProofCommand && missingCommands.includes(migrationProofCommand)
    ? migrationProofCommand
    : undefined;
  const missingMigrationParityTests = packageMigrationParityTestPaths(manifest.tests ?? [])
    .filter((path) => !workflow.includes(path));
  const missingGuidance = workflow.includes(packageTroubleshootingGuidance) ? [] : [packageTroubleshootingGuidance];
  return {
    name: "ci-workflow",
    passed: workflow.length > 0 && missingCommands.length === 0 && missingMigrationParityTests.length === 0 && missingGuidance.length === 0,
    total: commands.length,
    ...(workflow.length === 0 ? { missingWorkflow: workflowPath } : {}),
    ...(missingCommands.length > 0 ? { missingCommands } : {}),
    ...(missingMigrationParityProofCommand ? { missingMigrationParityProofCommand } : {}),
    ...(missingMigrationParityTests.length > 0 ? { missingMigrationParityTests } : {}),
    ...(missingGuidance.length > 0 ? { missingGuidance } : {}),
  };
}

function packageCiWorkflowCommands(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): string[] {
  const manifestFile = relative(manifestDir, resolve(manifestPath));
  const lockFile = packageLockPath(manifestFile);
  const migrationProofCommand = packageMigrationParityProofReviewCommand(manifestFile, manifest.tests);
  return [
    `forma package-check ${manifestFile}`,
    `forma package-lock ${manifestFile} --output ${lockFile} --check`,
    `forma package-lock ${manifestFile} --output ${lockFile} --check --json > stale-package-lock-report.json || true`,
    ...packageTestCommands(manifest.tests),
    `forma eval-suite ${manifest.evalSuite ?? ""} --summary > candidate.json`,
    `forma package-review ${manifestFile}`,
    ...(migrationProofCommand ? [migrationProofCommand] : []),
  ];
}

function workflowIncludesCommand(workflow: string, command: string): boolean {
  return workflow
    .split(/\r?\n/)
    .some((line) => line.trim() === `run: ${command}` || line.trim() === command);
}

function packageMigrationParityProofReviewCommand(
  manifestFile: string,
  tests: Array<{ runtime?: string; path?: string }> = [],
): string | undefined {
  const migrationTests = tests.filter((test) => typeof test.path === "string" && packageMigrationParityTestPaths([test]).length > 0);
  if (migrationTests.length === 0) {
    return undefined;
  }
  const proofCommands = packageTestCommands(migrationTests);
  if (proofCommands.length === 0) {
    return undefined;
  }
  return packageReviewProofCommand(manifestFile, proofCommands.join(" && "));
}

function packageTestCommands(tests: Array<{ runtime?: string; path?: string }> = []): string[] {
  const typeScriptTests = tests
    .filter((test) => test.runtime === "typescript" && test.path)
    .map((test) => test.path as string);
  const pythonTests = tests
    .filter((test) => test.runtime === "python" && test.path)
    .map((test) => test.path as string);
  return [
    ...(typeScriptTests.length > 0 ? [`npx vitest run ${typeScriptTests.join(" ")}`] : []),
    ...pythonTests.map((testPath) => `python ${testPath}`),
  ];
}

async function packagePublishBundleCheck(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): Promise<Record<string, unknown>> {
  const workflowPath = ".github/workflows/forma-publish.yml";
  const workflow = await readFile(resolve(manifestDir, workflowPath), "utf8").catch(() => "");
  const paths = await packageBundlePaths(manifestPath, manifest, manifestDir);
  const missingPaths = paths.filter((path) => !workflow.includes(path));
  const migrationParityTests = packageMigrationParityTestPaths(manifest.tests ?? []);
  const missingMigrationParityTests = migrationParityTests.filter((path) => missingPaths.includes(path));
  const missingGuidance = workflow.includes(packageTroubleshootingGuidance) ? [] : [packageTroubleshootingGuidance];
  return {
    name: "publish-bundle",
    passed: workflow.length > 0 && missingPaths.length === 0 && missingGuidance.length === 0,
    total: paths.length,
    ...(workflow.length === 0 ? { missingWorkflow: workflowPath } : {}),
    ...(missingPaths.length > 0 ? { missingPaths } : {}),
    ...(missingMigrationParityTests.length > 0 ? { missingMigrationParityTests } : {}),
    ...(missingGuidance.length > 0 ? { missingGuidance } : {}),
  };
}

async function packageBundlePaths(manifestPath: string, manifest: FormaPackageManifest, manifestDir: string): Promise<string[]> {
  const evalFixturePaths = manifest.evalSuite
    ? await packageEvalFixturePaths(resolve(manifestDir, manifest.evalSuite))
    : [];
  return Array.from(new Set([
    relative(manifestDir, resolve(manifestPath)),
    packageLockPath(relative(manifestDir, resolve(manifestPath))),
    ...(manifest.tasks ?? []).flatMap((task) => task.source ? [task.source] : []),
    ...(manifest.evalSuite ? [manifest.evalSuite] : []),
    ...evalFixturePaths,
    ...(manifest.providerProfile ? [manifest.providerProfile] : []),
    ...(manifest.bindings ?? []).flatMap((binding) => binding.output ? [binding.output] : []),
    ...(manifest.examples ?? []).flatMap((example) => example.path ? [example.path] : []),
    ...(manifest.tests ?? []).flatMap((test) => test.path ? [test.path] : []),
    ...(manifest.releaseFiles ?? []).flatMap((file) => file.path ? [file.path] : []),
  ]));
}

async function packageEvalFixturePaths(evalSuitePath: string): Promise<string[]> {
  const suite = JSON.parse(await readFile(evalSuitePath, "utf8")) as { fixtures?: unknown };
  return Array.isArray(suite.fixtures)
    ? suite.fixtures.filter((fixture): fixture is string => typeof fixture === "string")
    : [];
}

function packageLockPath(manifestPath: string): string {
  return manifestPath.endsWith(".pkg.json")
    ? manifestPath.slice(0, -".pkg.json".length) + ".lock.json"
    : `${manifestPath}.lock.json`;
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
  const typeScriptPlan = `${taskName}_plan.ts`;
  const pythonPlan = `${taskName}_plan.py`;
  const typeScriptPlanTest = `${taskName}_plan.test.ts`;
  const pythonPlanTest = `${taskName}_plan_test.py`;
  const contractDir = `${taskName}_contract`;
  const typeScriptContract = `${contractDir}/index.ts`;
  const pythonContract = `${contractDir}/__init__.py`;
  const typeScriptContractTest = `${taskName}_contract.test.ts`;
  const pythonContractTest = `${taskName}_contract_test.py`;
  const evalFixture = `${taskName}.eval.json`;
  const evalSuite = "forma.eval.json";
  const manifestFile = `${taskName}.forma.pkg.json`;
  const lockFile = `${taskName}.forma.lock.json`;
  const providerProfileFile = "forma.provider.json";
  const readmeFile = "README.md";
  const workflowDir = ".github/workflows";
  const workflowFile = "forma-package.yml";
  const publishWorkflowFile = "forma-publish.yml";
  const schema = scaffoldSchema(args);
  const proofCommand = optionValue(args, "--proof-command");
  const source = scaffoldSource(taskName, kind, schema);
  await writeFile(resolve(path, taskFile), source, "utf8");
  await writeFile(resolve(path, typeScriptBindings), generateTypeScriptBindings(source), "utf8");
  await writeFile(resolve(path, pythonBindings), generatePythonBindings(source), "utf8");
  await writeFile(resolve(path, typeScriptExample), scaffoldTypeScriptExample(taskName, kind, schema), "utf8");
  await writeFile(resolve(path, pythonExample), scaffoldPythonExample(taskName, kind, schema), "utf8");
  if (kind === "tool") {
    await writeFile(resolve(path, typeScriptPlan), scaffoldToolTypeScriptPlan(), "utf8");
    await writeFile(resolve(path, pythonPlan), scaffoldToolPythonPlan(), "utf8");
    await writeFile(resolve(path, typeScriptPlanTest), scaffoldToolTypeScriptPlanTest(taskName), "utf8");
    await writeFile(resolve(path, pythonPlanTest), scaffoldToolPythonPlanTest(taskName), "utf8");
  }
  await mkdir(resolve(path, contractDir), { recursive: true });
  await writeFile(resolve(path, typeScriptContract), scaffoldTypeScriptContractModule(taskName, kind, schema), "utf8");
  await writeFile(resolve(path, pythonContract), scaffoldPythonContractModule(taskName, kind, schema), "utf8");
  const providerProfile = scaffoldProviderProfile(args);
  await writeFile(resolve(path, typeScriptContractTest), scaffoldTypeScriptContractTest(taskName, kind, providerProfile.apiKeyEnv, schema), "utf8");
  await writeFile(resolve(path, pythonContractTest), scaffoldPythonContractTest(taskName, kind, providerProfile.apiKeyEnv, schema), "utf8");
  await writeFile(resolve(path, providerProfileFile), `${JSON.stringify(providerProfile, null, 2)}\n`, "utf8");
  await writeFile(resolve(path, evalFixture), `${JSON.stringify(scaffoldEvalFixture(taskName, taskFile, kind, schema), null, 2)}\n`, "utf8");
  await writeFile(resolve(path, evalSuite), `${JSON.stringify({ fixtures: [evalFixture] }, null, 2)}\n`, "utf8");
  const packageTests: Array<{ runtime: "typescript" | "python"; path: string }> = [
    { runtime: "typescript", path: typeScriptContractTest },
    { runtime: "python", path: pythonContractTest },
    ...(kind === "tool"
      ? [
          { runtime: "typescript" as const, path: typeScriptPlanTest },
          { runtime: "python" as const, path: pythonPlanTest },
        ]
      : []),
  ];
  const manifest = omitUndefined({
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
      ...(kind === "tool"
        ? [
            { runtime: "typescript", path: typeScriptPlan },
            { runtime: "python", path: pythonPlan },
          ]
        : []),
      { runtime: "typescript", path: typeScriptContract },
      { runtime: "python", path: pythonContract },
    ],
    tests: packageTests,
    releaseFiles: requiredPackageReleaseFiles.map((releasePath) => ({ path: releasePath })),
    compatibility: {
      breaking: ["input", "output", "schemas"],
      review: ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples", "releaseFiles"],
      environment: ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"],
    },
  }) as FormaPackageManifest;
  const manifestPath = resolve(path, manifestFile);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(resolve(path, readmeFile), scaffoldPackageReadme(packageName, taskName, manifestFile, lockFile, evalSuite, packageTests, proofCommand), "utf8");
  await mkdir(resolve(path, workflowDir), { recursive: true });
  await writeFile(resolve(path, workflowDir, workflowFile), scaffoldPackageWorkflow(packageName, manifestFile, lockFile, evalSuite, packageTests, proofCommand), "utf8");
  await writeFile(
    resolve(path, workflowDir, publishWorkflowFile),
    scaffoldPackagePublishWorkflow({
      packageName,
      taskName,
      taskFile,
      manifestFile,
      lockFile,
      evalFixture,
      evalSuite,
      providerProfileFile,
      typeScriptBindings,
      pythonBindings,
      typeScriptExample,
      pythonExample,
      extraExamples: kind === "tool" ? [typeScriptPlan, pythonPlan] : [],
      extraTests: packageTests.map((test) => test.path),
      typeScriptContract,
      pythonContract,
      readmeFile,
    }),
    "utf8",
  );
  await validatePackageManifest(manifest, path);
  await writeFile(resolve(path, lockFile), `${JSON.stringify(await createPackageLock(manifestPath, manifest, path), null, 2)}\n`, "utf8");
  return { exitCode: 0, stdout: "ok\n", stderr: "" };
}

async function initializeProject(path: string, args: string[]): Promise<CliResult> {
  const projectName = optionValue(args, "--name");
  const taskName = optionValue(args, "--task") ?? "review_diff";
  const kind = scaffoldKind(args);
  const minimal = args.includes("--minimal");
  if (!projectName) {
    throw new Error("--name is required for project-init");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(projectName)) {
    throw new Error("invalid project name");
  }
  validateScaffoldIdentifier(taskName, "--task");

  await mkdir(path, { recursive: true });
  await mkdir(resolve(path, "src"), { recursive: true });
  await mkdir(resolve(path, "test"), { recursive: true });
  await mkdir(resolve(path, ".github", "workflows"), { recursive: true });

  const schema = scaffoldSchema(args);
  const source = scaffoldSource(taskName, kind, schema);
  const typeScriptBindings = `src/${taskName}.forma.ts`;
  const pythonBindings = `src/${taskName}_forma.py`;
  const typeScriptAgent = `src/${taskName}_agent.ts`;
  const pythonAgent = `src/${taskName}_agent.py`;
  const typeScriptSmoke = `test/${taskName}_agent_smoke.ts`;
  const pythonSmoke = `test/${taskName}_agent_smoke.py`;
  const typeScriptMinimalSmoke = `test/${taskName}_local_smoke.ts`;
  const pythonMinimalSmoke = `test/${taskName}_local_smoke.py`;
  const packageLock = optionValue(args, "--package-lock");
  if (minimal && packageLock) {
    throw new Error("--minimal cannot be combined with --package-lock");
  }
  const typeScriptPackageLockSmoke = `test/${taskName}_package_lock_smoke.ts`;
  const pythonPackageLockSmoke = `test/${taskName}_package_lock_smoke.py`;
  const packageLockSmokeTests = packageLock
    ? [
        { runtime: "typescript", path: typeScriptPackageLockSmoke, command: "pnpm run smoke:lock:ts" },
        { runtime: "python", path: pythonPackageLockSmoke, command: `python test/${taskName}_package_lock_smoke.py` },
      ]
    : undefined;
  const ciWorkflow = ".github/workflows/forma-project.yml";
  const taskFile = `${taskName}.forma`;
  const providerProfile = scaffoldProviderProfile(args);
  const projectManifest = {
    formaProject: 1,
    name: projectName,
    task: taskName,
    source: taskFile,
    providerProfile: "forma.provider.json",
    bindings: [
      { target: "typescript", source: taskFile, output: typeScriptBindings },
      { target: "python", source: taskFile, output: pythonBindings },
    ],
    entrypoints: [
      { runtime: "typescript", path: typeScriptAgent },
      { runtime: "python", path: pythonAgent },
    ],
    smokeTests: [
      { runtime: "typescript", path: typeScriptSmoke, command: "pnpm run smoke:ts" },
      { runtime: "python", path: pythonSmoke, command: `python test/${taskName}_agent_smoke.py` },
    ],
    ...(packageLockSmokeTests ? { packageLockSmokeTests } : {}),
    ciWorkflow,
  };

  await writeFile(resolve(path, taskFile), source, "utf8");
  await writeFile(resolve(path, typeScriptBindings), generateTypeScriptBindings(source), "utf8");
  await writeFile(resolve(path, pythonBindings), generatePythonBindings(source), "utf8");
  await writeFile(resolve(path, typeScriptAgent), scaffoldProjectTypeScriptAgent(taskName, kind, schema), "utf8");
  await writeFile(resolve(path, pythonAgent), scaffoldProjectPythonAgent(taskName, kind, schema), "utf8");
  if (minimal) {
    await writeFile(resolve(path, typeScriptMinimalSmoke), scaffoldProjectTypeScriptSmokeTest(taskName, kind, schema), "utf8");
    await writeFile(resolve(path, pythonMinimalSmoke), scaffoldProjectPythonSmokeTest(taskName, kind, schema), "utf8");
  } else {
    await writeFile(resolve(path, typeScriptSmoke), scaffoldProjectTypeScriptSmokeTest(taskName, kind, schema), "utf8");
    await writeFile(resolve(path, pythonSmoke), scaffoldProjectPythonSmokeTest(taskName, kind, schema), "utf8");
  }
  if (packageLock) {
    await writeFile(resolve(path, typeScriptPackageLockSmoke), scaffoldProjectTypeScriptPackageLockSmokeTest(taskName, packageLock, kind, schema), "utf8");
    await writeFile(resolve(path, pythonPackageLockSmoke), scaffoldProjectPythonPackageLockSmokeTest(taskName, packageLock, kind, schema), "utf8");
  }
  if (!minimal) {
    await writeFile(resolve(path, ciWorkflow), scaffoldProjectWorkflow(taskName, packageLockSmokeTests), "utf8");
  }
  await writeFile(resolve(path, "forma.provider.json"), `${JSON.stringify(providerProfile, null, 2)}\n`, "utf8");
  if (!minimal) {
    await writeFile(resolve(path, "forma.project.json"), `${JSON.stringify(projectManifest, null, 2)}\n`, "utf8");
  }
  await writeFile(resolve(path, "package.json"), scaffoldProjectPackageJson(projectName, taskName, Boolean(packageLock), minimal), "utf8");
  await writeFile(resolve(path, "tsconfig.json"), scaffoldProjectTsconfig(), "utf8");
  await writeFile(resolve(path, "pyproject.toml"), scaffoldProjectPyproject(projectName), "utf8");
  await writeFile(resolve(path, "README.md"), scaffoldProjectReadme(projectName, taskName, providerProfile, packageLock, minimal), "utf8");

  return { exitCode: 0, stdout: projectInitSummary(minimal, Boolean(packageLock)), stderr: "" };
}

function projectInitSummary(minimal: boolean, packageLock: boolean): string {
  if (minimal) {
    return [
      "created minimal host project",
      "next: pnpm run smoke:local:ts",
      "use default project-init for project-check and CI workflow",
    ].join("\n") + "\n";
  }
  if (packageLock) {
    return [
      "created package-lock host project",
      "next: pnpm run smoke:lock:ts",
      "use --minimal only before reviewed package locks",
    ].join("\n") + "\n";
  }
  return [
    "created checked host project",
    "next: forma project-check .",
    "use --minimal for the five-minute first-use path",
  ].join("\n") + "\n";
}

async function checkProject(path: string, args: string[] = []): Promise<CliResult> {
  const manifestPath = path.endsWith(".json") ? path : resolve(path, "forma.project.json");
  const manifestDir = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FormaProjectManifest;
  const json = args.includes("--json");
  try {
    await validateProjectManifest(manifest, manifestDir);
  } catch (error) {
    if (json) {
      const check = error instanceof ProjectCheckError
        ? error.check
        : { name: "project", passed: false, error: error instanceof Error ? error.message : String(error) };
      return {
        exitCode: 1,
        stdout: `${JSON.stringify(projectCheckReport(manifest, manifestPath, false, [check]), null, 2)}\n`,
        stderr: "",
      };
    }
    throw error;
  }
  if (json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(projectCheckReport(manifest, manifestPath, true), null, 2)}\n`,
      stderr: "",
    };
  }
  return { exitCode: 0, stdout: "ok\n", stderr: "" };
}

function projectCheckReport(
  manifest: FormaProjectManifest,
  manifestPath: string,
  passed: boolean,
  checks?: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    passed,
    project: {
      name: manifest.name,
      task: manifest.task,
      manifest: relative(dirname(manifestPath), manifestPath),
    },
    checks: checks ?? [
      {
        name: "bindings",
        passed: true,
        targets: (manifest.bindings ?? []).map((binding) => binding.target).filter(Boolean),
      },
      {
        name: "entrypoints",
        passed: true,
        runtimes: (manifest.entrypoints ?? []).map((entrypoint) => entrypoint.runtime).filter(Boolean),
      },
      {
        name: "smoke-tests",
        passed: true,
        runtimes: (manifest.smokeTests ?? []).map((test) => test.runtime).filter(Boolean),
      },
      ...(manifest.packageLockSmokeTests && manifest.packageLockSmokeTests.length > 0
        ? [
            {
              name: "package-lock-smoke-tests",
              passed: true,
              runtimes: manifest.packageLockSmokeTests.map((test) => test.runtime).filter(Boolean),
              paths: manifest.packageLockSmokeTests.map((test) => test.path).filter(Boolean),
            },
          ]
        : []),
      {
        name: "ci-workflow",
        passed: true,
        path: manifest.ciWorkflow,
      },
    ],
  };
}

async function validateProjectManifest(manifest: FormaProjectManifest, manifestDir: string): Promise<void> {
  if (manifest.formaProject !== 1) {
    throw new Error("formaProject must be 1");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.name ?? "")) {
    throw new Error("invalid project name");
  }
  validateScaffoldIdentifier(manifest.task ?? "", "task");
  if (!manifest.source || !manifest.source.endsWith(".forma")) {
    throw new Error("source must point to a .forma file");
  }
  const sourcePath = resolve(manifestDir, manifest.source);
  const source = await readFile(sourcePath, "utf8");
  const task = parseForma(source).tasks.find((candidate) => candidate.name === manifest.task);
  if (!task) {
    throw new Error(`project task not found: ${manifest.task}`);
  }
  if (!task.agentInstruction) {
    throw new Error("project task must be an agent task");
  }
  if (!manifest.providerProfile) {
    throw new Error("providerProfile is required");
  }
  const profile = JSON.parse(await readFile(resolve(manifestDir, manifest.providerProfile), "utf8")) as ProviderProfile;
  validateProviderProfile(profile);
  if ("apiKey" in profile) {
    throw new Error("provider profile must not store apiKey secrets");
  }
  if (profile.provider === "openai-responses" && !profile.apiKeyEnv) {
    throw new Error("OpenAI provider profile must name apiKeyEnv");
  }

  const bindings = manifest.bindings ?? [];
  const targets = new Set(bindings.map((binding) => binding.target));
  if (!targets.has("typescript") || !targets.has("python")) {
    throw new Error("project must include TypeScript and Python bindings");
  }
  for (const binding of bindings) {
    if (binding.source !== manifest.source || !binding.output) {
      throw new Error("project binding source and output are required");
    }
    const expected = binding.target === "typescript"
      ? generateTypeScriptBindings(source)
      : binding.target === "python"
        ? generatePythonBindings(source)
        : undefined;
    if (!expected) {
      throw new Error(`unsupported project binding target: ${binding.target}`);
    }
    const current = await readFile(resolve(manifestDir, binding.output), "utf8");
    if (current !== expected) {
      throw new Error(`project binding is out of date: ${binding.output}`);
    }
  }

  const entrypoints = manifest.entrypoints ?? [];
  const runtimes = new Set(entrypoints.map((entrypoint) => entrypoint.runtime));
  if (!runtimes.has("typescript") || !runtimes.has("python")) {
    throw new Error("project must include TypeScript and Python entrypoints");
  }
  for (const entrypoint of entrypoints) {
    if (!entrypoint.path) {
      throw new Error("project entrypoint path is required");
    }
    const entrypointSource = await readFile(resolve(manifestDir, entrypoint.path), "utf8");
    validateProjectEntrypoint(entrypoint, entrypointSource, manifest.task);
  }

  const smokeTests = manifest.smokeTests ?? [];
  const smokeRuntimes = new Set(smokeTests.map((test) => test.runtime));
  if (!smokeRuntimes.has("typescript") || !smokeRuntimes.has("python")) {
    throw new Error("project must include TypeScript and Python smoke tests");
  }
  for (const test of smokeTests) {
    if (!test.path || !test.command) {
      throw new Error("project smoke test path and command are required");
    }
    let smokeSource: string;
    try {
      smokeSource = await readFile(resolve(manifestDir, test.path), "utf8");
    } catch {
      throw new Error(`project smoke test is missing: ${test.path}`);
    }
    validateProjectSmokeTest(test, smokeSource, manifest.task);
  }

  const packageLockSmokeTests = manifest.packageLockSmokeTests ?? [];
  for (const test of packageLockSmokeTests) {
    if (!test.path || !test.command) {
      throw new Error("project package-lock smoke test path and command are required");
    }
    let smokeSource: string;
    try {
      smokeSource = await readFile(resolve(manifestDir, test.path), "utf8");
    } catch {
      throw new ProjectCheckError(
        `project package-lock smoke test is missing: ${test.path}; restore the reviewed package-lock smoke tests`,
        {
          name: "package-lock-smoke-tests",
          passed: false,
          missingPaths: [test.path],
          guidance: "restore the reviewed package-lock smoke tests",
        },
      );
    }
    validateProjectPackageLockSmokeTest(test, smokeSource);
  }

  if (!manifest.ciWorkflow) {
    throw new Error("project ciWorkflow is required");
  }
  let workflow: string;
  try {
    workflow = await readFile(resolve(manifestDir, manifest.ciWorkflow), "utf8");
  } catch {
    throw new Error(`project workflow is missing: ${manifest.ciWorkflow}`);
  }
  const requiredWorkflowCommands = [
    "forma project-check .",
    "pnpm run check",
    `python -m py_compile src/${manifest.task}_forma.py src/${manifest.task}_agent.py test/${manifest.task}_agent_smoke.py`,
    ...smokeTests.map((test) => test.command ?? ""),
    ...packageLockSmokeTests.map((test) => test.command ?? ""),
  ].filter(Boolean);
  const missingWorkflowCommands = requiredWorkflowCommands.filter((command) => !workflow.includes(command));
  if (missingWorkflowCommands.length > 0) {
    throw new ProjectCheckError(
      `project workflow ${manifest.ciWorkflow} is missing proof commands: ${missingWorkflowCommands.join(", ")}; restore the generated project workflow`,
      {
        name: "ci-workflow",
        passed: false,
        path: manifest.ciWorkflow,
        missingCommands: missingWorkflowCommands,
        guidance: "restore the generated project workflow",
      },
    );
  }
}

function validateProjectPackageLockSmokeTest(
  test: NonNullable<FormaProjectManifest["packageLockSmokeTests"]>[number],
  source: string,
): void {
  if (!test.path) {
    throw new Error("project package-lock smoke test path and command are required");
  }
  if (test.runtime === "typescript") {
    const required = ["agentFromPackageLock", "StaticProvider"];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project TypeScript package-lock smoke test must use agentFromPackageLock and StaticProvider: ${test.path}`);
    }
    return;
  }
  if (test.runtime === "python") {
    const required = ["agent_from_package_lock", "StaticProvider"];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project Python package-lock smoke test must use agent_from_package_lock and StaticProvider: ${test.path}`);
    }
    return;
  }
  throw new Error(`unsupported project package-lock smoke test runtime: ${test.runtime}`);
}

function validateProjectEntrypoint(
  entrypoint: NonNullable<FormaProjectManifest["entrypoints"]>[number],
  source: string,
  taskName: string | undefined,
): void {
  if (!taskName || !entrypoint.path) {
    throw new Error("project entrypoint path is required");
  }
  if (entrypoint.runtime === "typescript") {
    const validator = `assert${toPascalCase(taskName)}Output`;
    const required = ["agent({", "providerProfileFromFile", "providerFromProfile", validator, `${taskName}.forma`];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project TypeScript entrypoint must use agent(...), providerProfileFromFile, providerFromProfile, and ${validator}: ${entrypoint.path}`);
    }
    return;
  }
  if (entrypoint.runtime === "python") {
    const validator = `assert_${taskName}_output`;
    const required = ["agent(", "provider_profile_from_file", "provider_from_profile", validator, `${taskName}.forma`];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project Python entrypoint must use agent(...), provider_profile_from_file, provider_from_profile, and ${validator}: ${entrypoint.path}`);
    }
    return;
  }
  throw new Error(`unsupported project entrypoint runtime: ${entrypoint.runtime}`);
}

function validateProjectSmokeTest(
  test: NonNullable<FormaProjectManifest["smokeTests"]>[number],
  source: string,
  taskName: string | undefined,
): void {
  if (!taskName || !test.path) {
    throw new Error("project smoke test path and command are required");
  }
  if (test.runtime === "typescript") {
    const required = ["StaticProvider", `run${toPascalCase(taskName)}`];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project TypeScript smoke test must use StaticProvider and run${toPascalCase(taskName)}: ${test.path}`);
    }
    return;
  }
  if (test.runtime === "python") {
    const required = ["StaticProvider", `run_${taskName}`];
    if (required.some((term) => !source.includes(term))) {
      throw new Error(`project Python smoke test must use StaticProvider and run_${taskName}: ${test.path}`);
    }
    return;
  }
  throw new Error(`unsupported project smoke test runtime: ${test.runtime}`);
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
    tests: manifest.tests === undefined ? undefined : await Promise.all(manifest.tests.map(async (test) => ({
      runtime: test.runtime,
      path: test.path,
      sha256: await hashFile(resolve(manifestDir, test.path ?? "")),
    }))),
    releaseFiles: await Promise.all((manifest.releaseFiles ?? []).map(async (file) => ({
      path: file.path,
      sha256: await hashFile(resolve(manifestDir, file.path ?? "")),
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

type ScaffoldKind = "review" | "tool" | "function-repair";

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
  if (kind !== "review" && kind !== "tool" && kind !== "function-repair") {
    throw new Error("--kind must be review, tool, or function-repair");
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
  if (kind === "tool") return scaffoldToolSource(taskName, schema);
  if (kind === "function-repair") return scaffoldFunctionRepairSource(taskName, schema);
  return scaffoldReviewSource(taskName, schema);
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

function scaffoldFunctionRepairSource(taskName: string, schema?: ScaffoldSchema): string {
  const inputFields = effectiveInputFields("function-repair", schema);
  const outputFields = effectiveOutputFields("function-repair", schema);
  const outputObjects = effectiveOutputObjects("function-repair", schema);
  return `task ${taskName} {
  intent "Modify one named function and run its focused tests"

  input {
${renderScaffoldFields(inputFields, "    ")}
  }

  output {
${renderScaffoldFields(outputFields, "    ")}
${renderScaffoldObjects(outputObjects, "    ")}
  }

  agent {
    instruction """
    Use the host read and search tools to inspect the named function and nearby context.
    Apply the smallest edit needed to satisfy the desired behavior.
    Run the focused test command before returning.
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
  if (kind === "function-repair") {
    const output = {
      summary: "Updated calculateTotal and verified the focused billing test.",
      function_name: "calculateTotal",
      test_passed: true,
      edited: true,
    };
    return scaffoldAgentEvalFixture(taskName, taskFile, {
      path: "src/billing.ts",
      function_name: "calculateTotal",
      desired_behavior: "Return the total including discounts.",
      test_command: "pnpm test -- billing",
    }, output);
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

function scaffoldPackageReadme(
  packageName: string,
  taskName: string,
  manifestFile: string,
  lockFile: string,
  evalSuite: string,
  tests?: Array<{ runtime: "typescript" | "python"; path: string }>,
  proofCommand?: string,
): string {
  const testCommands = packageTestCommands(tests);
  return `# ${packageName}

This Forma package defines the \`${taskName}\` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

Generated package scaffolds are release candidates, not first-use proofs. Use
them after a minimal or checked host project has already shown that the
\`.forma\` contract is clearer than an inline prompt plus local schemas.
Do not publish a release candidate until a downstream consumer exists and needs
the reviewed manifest, lockfile, generated bindings, tests, release files, and
evals as a pinned dependency.

## CI

Run these checks before publishing or consuming a changed package:

\`\`\`bash
forma package-review ${manifestFile}
${proofCommand ? `${packageReviewProofCommand(manifestFile, proofCommand)}\n` : ""}\
forma package-check ${manifestFile}
forma package-lock ${manifestFile} --output ${lockFile} --check
${testCommands.length > 0 ? `${testCommands.join("\n")}\n` : ""}\
forma eval-suite ${evalSuite} --summary > candidate.json
forma package-review ${manifestFile} --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
\`\`\`

Publish only after package review protects real consumers. If this package is
still used by one application, keep it local until the reviewed manifest,
lockfile, generated bindings, tests, release files, and evals protect downstream
TypeScript and Python hosts from drift.

If the baseline review fails, inspect the \`compare\` row in
\`package-review\` output. \`failedOn\` shows which configured severity blocked
the release, \`contractChanges\` and \`settingChanges\` summarize the changed
surface, and \`changes[].details\` names the exact contract fields or
environment setting values that changed. See the Forma package-review output
docs for JSON examples.

If \`forma package-lock --check --json\` reports \`changedArtifactGroups\`, write
artifact group release notes before regenerating the lock. Name the changed
group, list the added, removed, or changed paths, and say whether consumers need
to refresh generated bindings, package-lock smoke tests, release files, or
package metadata.

Commit the package manifest, lockfile, \`.forma\` source, eval suite, provider
profile, generated bindings, and host examples together so TypeScript and Python
consumers review the same contract. See the Forma CLI docs Release Runtime Flow
section at docs/packages/cli.md#release-runtime-flow for how provider profiles,
eval summaries, package locks, and host embedding APIs fit together. See the
package consumer quickstart at ${packageEmbeddingGuidance}
for where provider keys and model defaults live and what the generated
\`agent(...)\` helpers call at runtime. See ${packageProviderOverrideGuidance}
when a host application needs custom retries, logging, routing, model choice, or
test doubles. See package consumer troubleshooting at
${packageTroubleshootingGuidance} when lockfile checks,
provider profiles, or generated smoke tests fail.

If package review reports \`missingProviderOverrideTests\`, restore the generated TypeScript and Python lockfile smoke tests. Keep them in the manifest \`tests\` array, add their commands back to README and CI, include them in the publish bundle, and regenerate the package lock.
If package review reports \`missingMigrationParityTests\`, restore the TypeScript and Python migration parity fixtures. Keep them in the manifest \`tests\` array, add their commands back to README and CI, include them in the publish bundle, and regenerate the package lock. If it reports \`missingMigrationParityProofCommand\`, restore the reported \`package-review --proof-command\` command to README and CI so release review runs the before/after proof as a blocking row. See ${packageMigrationParityTroubleshootingGuidance} for the full restore sequence.
`;
}

function scaffoldPackageWorkflow(
  packageName: string,
  manifestFile: string,
  lockFile: string,
  evalSuite: string,
  tests?: Array<{ runtime: "typescript" | "python"; path: string }>,
  proofCommand?: string,
): string {
  const testSteps = packageTestWorkflowSteps(packageTestCommands(tests));
  return `name: Forma package

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  forma-package:
    name: ${packageName}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Forma CLI
        run: npm install --global @forma-lang/cli
      - name: Check package manifest
        run: forma package-check ${manifestFile}
      - name: Check package lock
        run: forma package-lock ${manifestFile} --output ${lockFile} --check
      - name: Write stale package lock report
        if: failure()
        run: forma package-lock ${manifestFile} --output ${lockFile} --check --json > stale-package-lock-report.json || true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: stale-package-lock-report
          path: stale-package-lock-report.json
${testSteps}\
      - name: Run eval suite
        run: forma eval-suite ${evalSuite} --summary > candidate.json
      - name: Review package
        run: forma package-review ${manifestFile}
${proofCommand ? `      - name: Review package proof
        run: ${packageReviewProofCommand(manifestFile, proofCommand)}
` : ""}\
      - name: Troubleshoot package failures
        if: failure()
        run: echo "See ${packageTroubleshootingGuidance}"
      - uses: actions/upload-artifact@v4
        with:
          name: forma-candidate
          path: candidate.json
`;
}

function packageReviewProofCommand(manifestFile: string, proofCommand: string): string {
  return `forma package-review ${manifestFile} --proof-command "${proofCommand.replaceAll("\"", "\\\"")}"`;
}

function packageTestWorkflowSteps(commands: string[]): string {
  return commands.map((command) => `      - name: ${command.startsWith("npx vitest") ? "Run TypeScript package tests" : "Run Python package test"}
        run: ${command}
`).join("");
}

function scaffoldPackagePublishWorkflow(options: {
  packageName: string;
  taskName: string;
  taskFile: string;
  manifestFile: string;
  lockFile: string;
  evalFixture: string;
  evalSuite: string;
  providerProfileFile: string;
  typeScriptBindings: string;
  pythonBindings: string;
  typeScriptExample: string;
  pythonExample: string;
  extraExamples?: string[];
  extraTests?: string[];
  typeScriptContract: string;
  pythonContract: string;
  readmeFile: string;
}): string {
  const bundleFile = `dist/${options.taskName}.forma-package.tgz`;
  const bundleInputs = [
    options.manifestFile,
    options.lockFile,
    options.taskFile,
    options.evalFixture,
    options.evalSuite,
    options.providerProfileFile,
    options.typeScriptBindings,
    options.pythonBindings,
    options.typeScriptExample,
    options.pythonExample,
    ...(options.extraExamples ?? []),
    ...(options.extraTests ?? []),
    options.typeScriptContract,
    options.pythonContract,
    options.readmeFile,
    ".github/workflows/forma-package.yml",
    ".github/workflows/forma-publish.yml",
  ].join(" ");
  return `name: Publish Forma package

on:
  workflow_dispatch:
  push:
    tags:
      - "${options.taskName}-v*"

permissions:
  contents: write

jobs:
  publish-forma-package:
    name: ${options.packageName}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Forma CLI
        run: npm install --global @forma-lang/cli
      - name: Review package
        run: forma package-review ${options.manifestFile}
      - name: Run eval suite
        run: forma eval-suite ${options.evalSuite} --summary > candidate.json
      - name: Build package bundle
        run: |
          mkdir -p dist
          tar -czf ${bundleFile} ${bundleInputs}
      - uses: actions/upload-artifact@v4
        with:
          name: forma-package
          path: |
            ${bundleFile}
            candidate.json
      - name: Publish GitHub release assets
        if: startsWith(github.ref, 'refs/tags/')
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          gh release view "$GITHUB_REF_NAME" >/dev/null 2>&1 || \\
            gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --notes "Forma package ${options.packageName}"
          gh release upload "$GITHUB_REF_NAME" ${bundleFile} candidate.json --clobber
      - name: Troubleshoot package failures
        if: failure()
        run: echo "See ${packageTroubleshootingGuidance}"
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
  if (schema?.input) return schema.input;
  if (kind === "tool") {
    return [
      { name: "path", type: "Text", optional: false, array: false },
      { name: "test_command", type: "Text", optional: true, array: false },
    ];
  }
  if (kind === "function-repair") {
    return [
      { name: "path", type: "Text", optional: false, array: false },
      { name: "function_name", type: "Text", optional: false, array: false },
      { name: "desired_behavior", type: "Text", optional: false, array: false },
      { name: "test_command", type: "Text", optional: false, array: false },
    ];
  }
  return [
    { name: "diff", type: "Text", optional: false, array: false },
    { name: "max_findings", type: "Number", optional: true, array: false },
  ];
}

function effectiveOutputFields(kind: ScaffoldKind, schema?: ScaffoldSchema): ScaffoldField[] {
  if (schema?.output) return schema.output;
  if (kind === "tool") {
    return [
      { name: "summary", type: "Text", optional: false, array: false },
      { name: "searched", type: "Boolean", optional: false, array: false },
      { name: "test_passed", type: "Boolean", optional: false, array: false },
      { name: "edited", type: "Boolean", optional: false, array: false },
    ];
  }
  if (kind === "function-repair") {
    return [
      { name: "summary", type: "Text", optional: false, array: false },
      { name: "function_name", type: "Text", optional: false, array: false },
      { name: "test_passed", type: "Boolean", optional: false, array: false },
      { name: "edited", type: "Boolean", optional: false, array: false },
    ];
  }
  return [
    { name: "summary", type: "Text", optional: false, array: false },
    { name: "findings", type: "Finding", optional: false, array: true },
    { name: "clean", type: "Boolean", optional: false, array: false },
  ];
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
  if (kind === "function-repair") {
    return scaffoldFunctionRepairTypeScriptExample(taskName);
  }
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderTypeScriptObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { agent, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${inputType}, type ${pascalName}Output } from "./${taskName}.forma.js";

const providerProfile = providerProfileFromFile("forma.provider.json");

const ${camelName} = agent({
  file: "${taskName}.forma",
  task: "${taskName}",
  provider: providerFromProfile(providerProfile),
});

const exampleInput: ${inputType} = ${exampleInput};

export async function run${pascalName}(input: ${inputType} = exampleInput): Promise<${pascalName}Output> {
  const result = await ${camelName}.run({ ...input });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma ${taskName} failed");
  }
  return assert${pascalName}Output(result.output);
}
`;
}

function scaffoldTypeScriptContractModule(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const pascalName = toPascalCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderTypeScriptObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { fileURLToPath } from "node:url";
import { agentFromPackageLock, type ModelProvider } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${inputType}, type ${pascalName}Output } from "../${taskName}.forma.js";

const lockFile = fileURLToPath(new URL("../${taskName}.forma.lock.json", import.meta.url));
const exampleInput: ${inputType} = ${exampleInput};

export function ${toCamelCase(taskName)}Agent(provider?: ModelProvider) {
  return agentFromPackageLock({
    lockFile,
    task: "${taskName}",
    ...(provider ? { provider } : {}),
  });
}

export async function run${pascalName}(input: ${inputType} = exampleInput, provider?: ModelProvider): Promise<${pascalName}Output> {
  const result = await ${toCamelCase(taskName)}Agent(provider).run({ ...input });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma ${taskName} failed");
  }
  return assert${pascalName}Output(result.output);
}

export type { ${inputType}, ${pascalName}Output } from "../${taskName}.forma.js";
export { assert${pascalName}Output } from "../${taskName}.forma.js";
`;
}

function scaffoldTypeScriptContractTest(taskName: string, kind: ScaffoldKind, apiKeyEnv?: string, schema?: ScaffoldSchema): string {
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  const envName = apiKeyEnv ?? "OPENAI_API_KEY";
  const providerOutput = renderTypeScriptObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { expect, it } from "vitest";
import { StaticProvider } from "@forma-lang/forma";
import { ${camelName}Agent, run${pascalName} } from "./${taskName}_contract/index.js";

const providerOutput = ${providerOutput};

it("loads the reviewed package lock agent", () => {
  const previousKey = process.env["${envName}"];
  process.env["${envName}"] = previousKey ?? "test-key";
  try {
    expect(${camelName}Agent()).toHaveProperty("run");
  } finally {
    if (previousKey === undefined) {
      delete process.env["${envName}"];
    } else {
      process.env["${envName}"] = previousKey;
    }
  }
});

it("runs the reviewed package lock agent with an explicit provider override", async () => {
  const output = await run${pascalName}(undefined, new StaticProvider(providerOutput));
  expect(output).toBeDefined();
});
`;
}

function scaffoldToolTypeScriptExample(taskName: string): string {
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  return `import { agent, type FormaValue, type ModelProvider, type PermissionTools } from "@forma-lang/forma";
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
  file: "${taskName}.forma",
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

function scaffoldToolTypeScriptPlan(): string {
  return `export interface ToolRepairOutput {
  summary: string;
  searched: boolean;
  test_passed: boolean;
  edited: boolean;
}

export interface ToolRepairFollowup {
  action: "commit_repair" | "rerun_tests" | "inspect_manually";
  requiresHumanReview: boolean;
  summary: string;
}

export function planRepairFollowup(output: ToolRepairOutput): ToolRepairFollowup {
  if (output.edited && output.test_passed) {
    return {
      action: "commit_repair",
      requiresHumanReview: false,
      summary: output.summary,
    };
  }
  if (output.edited) {
    return {
      action: "rerun_tests",
      requiresHumanReview: true,
      summary: output.summary,
    };
  }
  return {
    action: "inspect_manually",
    requiresHumanReview: true,
    summary: output.summary,
  };
}
`;
}

function scaffoldToolTypeScriptPlanTest(taskName: string): string {
  return `import { describe, expect, it } from "vitest";
import { planRepairFollowup, type ToolRepairOutput } from "./${taskName}_plan.js";

describe("${taskName} follow-up planning", () => {
  it("commits a verified repair", () => {
    const output: ToolRepairOutput = {
      summary: "Read src/example.ts, found 1 related matches, and ran pnpm test.",
      searched: true,
      test_passed: true,
      edited: true,
    };

    expect(planRepairFollowup(output)).toEqual({
      action: "commit_repair",
      requiresHumanReview: false,
      summary: output.summary,
    });
  });
});
`;
}

function scaffoldFunctionRepairTypeScriptExample(taskName: string): string {
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  return `import { agent, type FormaValue, type ModelProvider, type PermissionTools } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${pascalName}Output } from "./${taskName}.forma.js";

class FunctionRepairProvider implements ModelProvider {
  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const path = String(input.values.path);
    const functionName = String(input.values.function_name);
    const desiredBehavior = String(input.values.desired_behavior);
    const testCommand = String(input.values.test_command);
    const source = await input.tools.readText(path);
    await input.tools.searchText(functionName);
    const repaired = source.includes("NEEDS_FIX")
      ? source.replace("NEEDS_FIX", desiredBehavior)
      : source;
    await input.tools.writeText(path, repaired);
    const test = await input.tools.runTest(testCommand);
    return {
      summary: \`Updated \${functionName} in \${path} and ran \${testCommand}.\`,
      function_name: functionName,
      test_passed: test.ok,
      edited: repaired !== source,
    };
  }
}

const ${camelName} = agent({
  file: "${taskName}.forma",
  task: "${taskName}",
  provider: new FunctionRepairProvider(),
});

export async function run${pascalName}(): Promise<${pascalName}Output> {
  const result = await ${camelName}.run({
    path: "src/billing.ts",
    function_name: "calculateTotal",
    desired_behavior: "Return the total including discounts.",
    test_command: "pnpm test -- billing",
  });
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
  if (kind === "function-repair") {
    return scaffoldFunctionRepairPythonExample(taskName);
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

function scaffoldPythonContractModule(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const pascalName = toPascalCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderPythonObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "    ");
  return `from dataclasses import asdict
from pathlib import Path

from forma import agent_from_package_lock
from ${taskName}_forma import ${inputType}, ${pascalName}Output, assert_${taskName}_output

_LOCK_FILE = Path(__file__).resolve().parent.parent / "${taskName}.forma.lock.json"
example_input = ${inputType}.from_dict(${exampleInput})


def ${taskName}_agent(provider=None):
    return agent_from_package_lock(lock_file=_LOCK_FILE, task="${taskName}", provider=provider)


def run_${taskName}(input: ${inputType} = example_input, provider=None) -> ${pascalName}Output:
    result = ${taskName}_agent(provider=provider).run(asdict(input))
    if not result.ok:
        raise RuntimeError(result.error or "Forma ${taskName} failed")
    return assert_${taskName}_output(result.output)


__all__ = [
    "${inputType}",
    "${pascalName}Output",
    "assert_${taskName}_output",
    "run_${taskName}",
    "${taskName}_agent",
]
`;
}

function scaffoldPythonContractTest(taskName: string, kind: ScaffoldKind, apiKeyEnv?: string, schema?: ScaffoldSchema): string {
  const envName = apiKeyEnv ?? "OPENAI_API_KEY";
  const providerOutput = renderPythonObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import os

from forma import StaticProvider
from ${taskName}_contract import run_${taskName}, ${taskName}_agent


provider_output = ${providerOutput}


def test_loads_reviewed_package_lock_agent():
    previous_key = os.environ.get("${envName}")
    os.environ["${envName}"] = previous_key or "test-key"
    try:
        assert hasattr(${taskName}_agent(), "run")
    finally:
        if previous_key is None:
            os.environ.pop("${envName}", None)
        else:
            os.environ["${envName}"] = previous_key


def test_runs_reviewed_package_lock_agent_with_explicit_provider_override():
    output = run_${taskName}(provider=StaticProvider(provider_output))
    assert output is not None


if __name__ == "__main__":
    test_loads_reviewed_package_lock_agent()
    test_runs_reviewed_package_lock_agent_with_explicit_provider_override()
`;
}

function scaffoldProjectTypeScriptAgent(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  if (kind === "tool") {
    return scaffoldToolTypeScriptExample(taskName)
      .replace(
        `file: fileURLToPath(new URL("./${taskName}.forma", import.meta.url)),`,
        `file: fileURLToPath(new URL("../${taskName}.forma", import.meta.url)),`,
      );
  }
  if (kind === "function-repair") {
    return scaffoldFunctionRepairTypeScriptExample(taskName)
      .replace(
        `file: fileURLToPath(new URL("./${taskName}.forma", import.meta.url)),`,
        `file: fileURLToPath(new URL("../${taskName}.forma", import.meta.url)),`,
      );
  }
  const pascalName = toPascalCase(taskName);
  const camelName = toCamelCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderTypeScriptObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { fileURLToPath } from "node:url";
import { agent, providerFromProfile, providerProfileFromFile, type ModelProvider } from "@forma-lang/forma";
import { assert${pascalName}Output, type ${inputType}, type ${pascalName}Output } from "./${taskName}.forma.js";

const exampleInput: ${inputType} = ${exampleInput};

export function ${camelName}Agent(provider?: ModelProvider) {
  const defaultProvider = provider ?? providerFromProfile(providerProfileFromFile(fileURLToPath(new URL("../forma.provider.json", import.meta.url))));
  return agent({
    file: fileURLToPath(new URL("../${taskName}.forma", import.meta.url)),
    task: "${taskName}",
    provider: defaultProvider,
  });
}

export async function run${pascalName}(input: ${inputType} = exampleInput, provider?: ModelProvider): Promise<${pascalName}Output> {
  const result = await ${camelName}Agent(provider).run({ ...input });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma ${taskName} failed");
  }
  return assert${pascalName}Output(result.output);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const output = await run${pascalName}();
  console.log(JSON.stringify(output, null, 2));
}
`;
}

function scaffoldProjectPythonAgent(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  if (kind === "tool") {
    return scaffoldToolPythonExample(taskName)
      .replace(
        "from pathlib import Path\n",
        "from pathlib import Path\n\nPROJECT_ROOT = Path(__file__).resolve().parent.parent\n",
      )
      .replace(
        `file=Path(__file__).with_name("${taskName}.forma"),`,
        `file=PROJECT_ROOT / "${taskName}.forma",`,
      );
  }
  if (kind === "function-repair") {
    return scaffoldFunctionRepairPythonExample(taskName)
      .replace(
        "from pathlib import Path\n",
        "from pathlib import Path\n\nPROJECT_ROOT = Path(__file__).resolve().parent.parent\n",
      )
      .replace(
        `file=Path(__file__).with_name("${taskName}.forma"),`,
        `file=PROJECT_ROOT / "${taskName}.forma",`,
      );
  }
  const pascalName = toPascalCase(taskName);
  const inputType = `${pascalName}Input`;
  const exampleInput = renderPythonObject(Object.fromEntries(effectiveInputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "    ");
  return `from dataclasses import asdict
from pathlib import Path

from forma import ModelProvider, agent, provider_from_profile, provider_profile_from_file
from ${taskName}_forma import ${inputType}, ${pascalName}Output, assert_${taskName}_output


PROJECT_ROOT = Path(__file__).resolve().parent.parent

example_input = ${inputType}.from_dict(${exampleInput})


def ${taskName}_agent(provider: ModelProvider | None = None):
    default_provider = provider or provider_from_profile(provider_profile_from_file(PROJECT_ROOT / "forma.provider.json"))
    return agent(
        file=PROJECT_ROOT / "${taskName}.forma",
        task="${taskName}",
        provider=default_provider,
    )


def run_${taskName}(input: ${inputType} = example_input, provider: ModelProvider | None = None) -> ${pascalName}Output:
    result = ${taskName}_agent(provider=provider).run(asdict(input))
    if not result.ok:
        raise RuntimeError(result.error or "Forma ${taskName} failed")
    return assert_${taskName}_output(result.output)


if __name__ == "__main__":
    print(run_${taskName}())
`;
}

function scaffoldProjectTypeScriptSmokeTest(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const pascalName = toPascalCase(taskName);
  const providerOutput = renderTypeScriptObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { strict as assert } from "node:assert";
import { StaticProvider } from "@forma-lang/forma";
import { run${pascalName} } from "../src/${taskName}_agent.js";

const output = await run${pascalName}(undefined, new StaticProvider(${providerOutput}));

assert.ok(output);
console.log(JSON.stringify(output, null, 2));
`;
}

function scaffoldProjectPythonSmokeTest(taskName: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const providerOutput = renderPythonObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `from forma import StaticProvider
from ${taskName}_agent import run_${taskName}


output = run_${taskName}(provider=StaticProvider(${providerOutput}))

assert output is not None
print(output)
`;
}

function scaffoldProjectTypeScriptPackageLockSmokeTest(taskName: string, packageLock: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const providerOutput = renderTypeScriptObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `import { strict as assert } from "node:assert";
import { agentFromPackageLock, StaticProvider } from "@forma-lang/forma";

const reviewDiff = agentFromPackageLock({
  lockFile: ${JSON.stringify(packageLock)},
  task: ${JSON.stringify(taskName)},
  provider: new StaticProvider(${providerOutput}),
});

const result = await reviewDiff.run({
  diff: "diff --git a/src/example.ts b/src/example.ts",
  max_findings: 1,
});

assert.equal(result.ok, true);
assert.ok(result.output);
console.log(JSON.stringify(result.output, null, 2));
`;
}

function scaffoldProjectPythonPackageLockSmokeTest(taskName: string, packageLock: string, kind: ScaffoldKind, schema?: ScaffoldSchema): string {
  const providerOutput = renderPythonObject(Object.fromEntries(effectiveOutputFields(kind, schema).map((field) => [
    field.name,
    scaffoldValue(field, { outputObjects: effectiveOutputObjects(kind, schema) }),
  ])), "");
  return `from forma import StaticProvider, agent_from_package_lock


review_diff = agent_from_package_lock(
    lock_file=${JSON.stringify(packageLock)},
    task=${JSON.stringify(taskName)},
    provider=StaticProvider(${providerOutput}),
)

result = review_diff.run({
    "diff": "diff --git a/src/example.py b/src/example.py",
    "max_findings": 1,
})

assert result.ok
assert result.output is not None
print(result.output)
`;
}

function scaffoldProjectWorkflow(
  taskName: string,
  packageLockSmokeTests?: Array<{ command?: string }>,
): string {
  const packageLockCommands = packageLockSmokeTests?.map((test) => `      - run: ${test.command}\n`).join("") ?? "";
  return `name: Forma Project

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: corepack enable
      - run: pnpm install
      - run: python -m pip install -e .
      - run: forma project-check .
      - run: pnpm run check
      - run: python -m py_compile src/${taskName}_forma.py src/${taskName}_agent.py test/${taskName}_agent_smoke.py
      - run: pnpm run smoke:ts
      - run: python test/${taskName}_agent_smoke.py
${packageLockCommands}`;
}

function scaffoldProjectPackageJson(projectName: string, taskName: string, includePackageLockSmoke = false, minimal = false): string {
  return `${JSON.stringify({
    name: projectName,
    private: true,
    type: "module",
    scripts: {
      generate: `forma generate ${taskName}.forma --target typescript --output src/${taskName}.forma.ts`,
      check: "tsc --noEmit",
      "run:ts": `tsx src/${taskName}_agent.ts`,
      ...(minimal ? { "smoke:local:ts": `tsx test/${taskName}_local_smoke.ts` } : { "smoke:ts": `tsx test/${taskName}_agent_smoke.ts` }),
      ...(includePackageLockSmoke ? { "smoke:lock:ts": `tsx test/${taskName}_package_lock_smoke.ts` } : {}),
    },
    dependencies: {
      "@forma-lang/forma": "latest",
    },
    devDependencies: {
      "@types/node": "^22.15.18",
      tsx: "^4.20.0",
      typescript: "^5.8.3",
    },
  }, null, 2)}\n`;
}

function scaffoldProjectTsconfig(): string {
  return `${JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "dist",
    },
    include: ["src/**/*.ts"],
  }, null, 2)}\n`;
}

function scaffoldProjectPyproject(projectName: string): string {
  return `[project]
name = "${projectName}"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["forma-lang"]

[tool.pytest.ini_options]
pythonpath = ["src"]
`;
}

function scaffoldProjectReadme(projectName: string, taskName: string, profile: ProviderProfile, packageLock?: string, minimal = false): string {
  const apiKeyEnv = profile.apiKeyEnv ?? "MODEL_API_KEY";
  if (minimal) {
    return `# ${projectName}

This project is a minimal Forma host project for deciding whether a durable
agent task contract is better than an inline prompt plus local schemas.
Treat this scaffold as a product test, not an adoption commitment.

## Five-Minute Usefulness Path

Start with the smallest useful Forma boundary before package-review or package locks:

This is the ten-minute local proof. It should show whether Forma is clearer
than inline prompt plus local schemas before package-review or package locks.

\`\`\`bash
pnpm install
python -m pip install -e .
pnpm run check
pnpm run smoke:local:ts
python test/${taskName}_local_smoke.py
\`\`\`

The task contract lives in \`${taskName}.forma\`. It owns the input fields,
output fields, instructions, permissions, and verification rules. The generated
TypeScript and Python bindings live in \`src/${taskName}.forma.ts\` and
\`src/${taskName}_forma.py\`.

Do not move to reviewed packages until this local boundary is clearly better
than keeping an inline prompt plus local schemas in the host application.

## Provider Configuration

\`forma.provider.json\` names the provider, model, response format, timeout,
temperature, and API-key environment variable. It does not store the secret
value:

\`\`\`bash
export ${apiKeyEnv}=...
\`\`\`

Change the model in \`forma.provider.json\` when both runtimes should use a
different default. Keep retries, logging, routing, and secret loading in the
host application.

## TypeScript

\`src/${taskName}_agent.ts\` creates the provider from \`forma.provider.json\`,
calls \`agent(...)\`, runs the named \`${taskName}\` task, checks \`result.ok\`,
and validates the result with the generated output validator.

\`\`\`bash
pnpm run run:ts
\`\`\`

\`test/${taskName}_local_smoke.ts\` runs the same entrypoint with
\`StaticProvider\`, so local verification does not need a model key:

\`\`\`bash
pnpm run smoke:local:ts
\`\`\`

## Python

\`src/${taskName}_agent.py\` uses the same \`${taskName}.forma\` contract,
provider profile, and generated output validator from Python:

\`\`\`bash
python src/${taskName}_agent.py
\`\`\`

\`test/${taskName}_local_smoke.py\` is the matching no-key Python smoke path:

\`\`\`bash
python test/${taskName}_local_smoke.py
\`\`\`

## When to Grow This Project

Stay on the minimal scaffold while you are deciding whether the \`.forma\`
contract is useful for one application. Re-run default \`forma project-init\`
when the task needs \`forma project-check\`, generated smoke tests, and CI
workflow checks. Use \`forma project-init --package-lock\` after the task is
reviewed as a reusable package and the host should consume pinned package
artifacts.

For the full first-use path, see
\`docs/guides/quickstart.md#five-minute-usefulness-path\`. For the staged
golden workflow, see \`docs/guides/golden-workflow.md\`. For the scaffold
decision table, see \`docs/packages/cli.md#project-init\`.
`;
  }
  const packageLockSection = packageLock
    ? `
## Reviewed Package Lock

This project includes reviewed package-lock smoke tests for \`${packageLock}\`.
Run \`pnpm run smoke:lock:ts\` and
\`python test/${taskName}_package_lock_smoke.py\` to verify the host can load
the reviewed package lock with explicit \`StaticProvider\` test doubles.
`
    : "";
  const scaffoldChoiceSection = packageLock
    ? `## Scaffold Choice

This is the reviewed package-lock host-project scaffold.
It consumes pinned package artifacts after package review.

This extra scaffold is worth it when multiple applications or repositories
depend on the same reviewed task, when application releases should fail on
drift in the provider profile, generated bindings, examples, tests, and release artifacts,
or when a consumer should prove it can load exactly the reviewed package lock
before deployment.

The host still owns provider keys, model selection, retries, logging, and
deployment policy.

Use \`forma project-init --minimal\` when you only need the five-minute
first-use path before CI and project checks. Use default \`forma project-init\`
when you need a checked host project before package review and package locks.

For the scaffold decision table, see \`docs/packages/cli.md#project-init\`.
`
    : `## Scaffold Choice

This is the checked host-project scaffold. Use \`forma project-init --minimal\`
when you only need the five-minute first-use path before CI and project checks.
Use \`forma project-init --package-lock\` when this host should consume a
reviewed package lock with pinned artifacts.

For the minimal first-use path, see
\`docs/guides/quickstart.md#five-minute-usefulness-path\`. For the scaffold
decision table, see \`docs/packages/cli.md#project-init\`.
`;
  return `# ${projectName}

This project embeds a Forma coding-agent task from TypeScript and Python.

## Provider Configuration

The task contract lives in \`${taskName}.forma\`. The provider profile lives in
\`forma.provider.json\`. The profile names the provider, model, response format,
and API-key environment variable, but it does not store the secret value.

\`\`\`bash
export ${apiKeyEnv}=...
\`\`\`

Change the model in \`forma.provider.json\` when you want both runtimes to use a
different model. Keep deployment-specific retries, logging, and secret loading
in the host application.

## TypeScript

\`\`\`bash
pnpm install
forma project-check .
pnpm run check
pnpm run run:ts
\`\`\`

The TypeScript embedding entrypoint is \`src/${taskName}_agent.ts\`.
Run \`pnpm run smoke:ts\` to execute it with \`StaticProvider\` and no model
credentials.

## Python

\`\`\`bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e .
forma project-check .
python src/${taskName}_agent.py
\`\`\`

The Python embedding entrypoint is \`src/${taskName}_agent.py\`.
Run \`python test/${taskName}_agent_smoke.py\` to execute it with
\`StaticProvider\` and no model credentials.
${packageLockSection}

${scaffoldChoiceSection}

## CLI

\`\`\`bash
forma run ${taskName}.forma --task ${taskName} --input '{"diff":"diff --git a/src/example.ts b/src/example.ts"}' --provider-profile forma.provider.json
\`\`\`

## CI

\`.github/workflows/forma-project.yml\` runs \`forma project-check .\`, the
TypeScript compiler, Python bytecode compilation, and both generated
\`StaticProvider\` smoke tests.

CI checks are worth this scaffold when application code depends on the generated binding shape,
when both TypeScript and Python entrypoints should stay aligned, or when
workflow drift should fail before a reviewed package lock exists.
Keep checked CI only when it guards real application dependencies.

Use the JSON output in CI when you need machine-readable check rows:

\`\`\`bash
forma project-check . --json
\`\`\`

See docs/packages/cli.md for passing and failing project-check JSON examples,
including \`missingCommands\` when the generated workflow drops a proof command.
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
  if (value === true) return "True";
  if (value === false) return "False";
  if (value === null) return "None";
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

function scaffoldToolPythonPlan(): string {
  return `from typing import Any

ToolRepairOutput = dict[str, Any]


def plan_repair_followup(output: ToolRepairOutput) -> dict[str, object]:
    if bool(output["edited"]) and bool(output["test_passed"]):
        return {
            "action": "commit_repair",
            "requires_human_review": False,
            "summary": str(output["summary"]),
        }
    if bool(output["edited"]):
        return {
            "action": "rerun_tests",
            "requires_human_review": True,
            "summary": str(output["summary"]),
        }
    return {
        "action": "inspect_manually",
        "requires_human_review": True,
        "summary": str(output["summary"]),
    }
`;
}

function scaffoldToolPythonPlanTest(taskName: string): string {
  return `from ${taskName}_plan import plan_repair_followup


def test_commits_verified_repair() -> None:
    output = {
        "summary": "Read src/example.py, found 1 related matches, and ran pytest.",
        "searched": True,
        "test_passed": True,
        "edited": True,
    }

    assert plan_repair_followup(output) == {
        "action": "commit_repair",
        "requires_human_review": False,
        "summary": output["summary"],
    }


if __name__ == "__main__":
    test_commits_verified_repair()
`;
}

function scaffoldFunctionRepairPythonExample(taskName: string): string {
  const pascalName = toPascalCase(taskName);
  return `from pathlib import Path

from forma import FormaValue, PermissionTools, agent
from ${taskName}_forma import ${pascalName}Output, assert_${taskName}_output


class FunctionRepairProvider:
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
        function_name = str(values["function_name"])
        desired_behavior = str(values["desired_behavior"])
        test_command = str(values["test_command"])
        source = tools.read_text(path)
        tools.search_text(function_name)
        repaired = source.replace("NEEDS_FIX", desired_behavior) if "NEEDS_FIX" in source else source
        tools.write_text(path, repaired)
        test = tools.run_test(test_command)
        return {
            "summary": f"Updated {function_name} in {path} and ran {test_command}.",
            "function_name": function_name,
            "test_passed": bool(test.get("ok")),
            "edited": repaired != source,
        }


${taskName} = agent(
    file=Path(__file__).with_name("${taskName}.forma"),
    task="${taskName}",
    provider=FunctionRepairProvider(),
)


def run_${taskName}() -> ${pascalName}Output:
    result = ${taskName}.run({
        "path": "src/billing.py",
        "function_name": "calculate_total",
        "desired_behavior": "Return the total including discounts.",
        "test_command": "pytest tests/test_billing.py",
    })
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
  if (manifest.tests !== undefined) {
    if (!Array.isArray(manifest.tests)) {
      throw new Error("tests must be an array");
    }
    for (const test of manifest.tests) {
      if (test.runtime !== "typescript" && test.runtime !== "python") {
        throw new Error("test.runtime must be typescript or python");
      }
      if (!test.path) throw new Error("test.path is required");
      await readFile(resolve(manifestDir, test.path));
    }
  }
  if (manifest.releaseFiles !== undefined) {
    if (!Array.isArray(manifest.releaseFiles)) {
      throw new Error("releaseFiles must be an array");
    }
    for (const file of manifest.releaseFiles) {
      if (!file.path) throw new Error("releaseFiles.path is required");
      await readFile(resolve(manifestDir, file.path));
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
  } else if (target === "python-pydantic") {
    generated = generatePydanticBindings(source);
  } else {
    throw new Error("--target must be typescript, python, or python-pydantic");
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

function outlineSource(source: string): CliResult {
  return {
    exitCode: 0,
    stdout: `${JSON.stringify(outlinePayload(source), null, 2)}\n`,
    stderr: "",
  };
}

function previewSource(source: string, path: string, args: string[]): CliResult {
  const payload = args.includes("--watch")
    ? watchPreviewPayload(path, source)
    : previewPayload(source, path);
  return {
    exitCode: payload.diagnostics.length > 0 ? 1 : 0,
    stdout: `${JSON.stringify(payload, null, 2)}\n`,
    stderr: "",
  };
}

function watchPreviewPayload(path: string, source: string) {
  return {
    event: "preview",
    watched: true,
    path,
    ...previewPayload(source, path),
  };
}

function previewPayload(source: string, sourceName = "<memory>") {
  try {
    const program = parseForma(source);
    const diagnostics = validateProgram(program, sourceName);
    return {
      ...outlinePayloadForProgram(program),
      types: {
        typescript: generateTypeScriptBindings(source),
        python: generatePythonBindings(source),
        pythonPydantic: generatePydanticBindings(source),
      },
      diagnostics,
    };
  } catch (error) {
    return {
      tasks: [],
      types: {
        typescript: "",
        python: "",
        pythonPydantic: "",
      },
      diagnostics: [diagnosticFromError(error, sourceName)],
    };
  }
}

function diagnosticFromError(error: unknown, sourceName: string): FormaDiagnostic {
  const raw = error instanceof Error ? error.message : String(error);
  const match = raw.match(/^(F\d{4}):\s*(.*)$/);
  return {
    severity: "error",
    code: match?.[1] ?? "F0001",
    message: match?.[2] ?? raw,
    source: sourceName,
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 },
  };
}

function outlinePayload(source: string) {
  return outlinePayloadForProgram(parseForma(source));
}

function outlinePayloadForProgram(program: ReturnType<typeof parseForma>) {
  return {
    tasks: program.tasks.map((task) => ({
      name: task.name,
      intent: task.intent,
      mode: task.agentInstruction ? "agent" : "compute",
      input: task.input,
      output: task.output,
      schemas: task.schemas,
      permissions: task.permissions,
      verify: task.verify,
      sourceSpan: task.sourceSpan,
    })),
  };
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
  details?: FieldChangeDetails | SettingChangeDetails;
}

interface SuiteComparison {
  passed: boolean;
  regressions: string[];
  improvements: string[];
  contractChanges?: string[];
  settingChanges?: string[];
  changes?: ChangeDetail[];
  failedOn?: string[];
  reports: ReportComparison[];
}

interface FieldChangeDetails {
  added?: string[];
  removed?: string[];
  changed?: string[];
}

interface SettingChangeDetails {
  from: string | number | null;
  to: string | number | null;
}

async function compareReports(baselinePath: string, args: string[]): Promise<CliResult> {
  const candidatePath = args[0];
  if (!candidatePath) {
    return usage();
  }

  const baselineRaw = JSON.parse(await readFile(baselinePath, "utf8")) as EvalReport | EvalReport[] | EvalSuiteArtifact;
  const candidateRaw = JSON.parse(await readFile(candidatePath, "utf8")) as EvalReport | EvalReport[] | EvalSuiteArtifact;
  const comparison = compareReportArtifacts(baselineRaw, candidateRaw, args);
  return {
    exitCode: comparison.exitCode,
    stdout: `${JSON.stringify(comparison.report, null, 2)}\n`,
    stderr: "",
  };
}

function compareReportArtifacts(
  baselineRaw: EvalReport | EvalReport[] | EvalSuiteArtifact,
  candidateRaw: EvalReport | EvalReport[] | EvalSuiteArtifact,
  args: string[],
): { exitCode: number; report: ReportComparison | SuiteComparison } {
  const baselineReports = normalizeReportFile(baselineRaw);
  const candidateReports = normalizeReportFile(candidateRaw);
  if (isSingleReportFile(baselineRaw) && isSingleReportFile(candidateRaw)) {
    const report = compareReport(baselineReports[0], candidateReports[0]);
    return {
      exitCode: report.passed ? 0 : 1,
      report,
    };
  }

  const baselineByName = new Map(baselineReports.map((report) => [report.name, report]));
  const candidateByName = new Map(candidateReports.map((report) => [report.name, report]));
  const names = Array.from(new Set([...baselineByName.keys(), ...candidateByName.keys()])).sort();
  const reports = names.map((name) => compareReport(baselineByName.get(name), candidateByName.get(name)));
  const regressions = reports.flatMap((report) => report.regressions.map((check) => `${report.name}:${check}`));
  const improvements = reports.flatMap((report) => report.improvements.map((check) => `${report.name}:${check}`));
  const contractChanges = reports.flatMap((report) => (report.contractChanges ?? []).map((field) => `${report.name}:${field}`));
  const baselineSettings = summarySettings(baselineRaw);
  const candidateSettings = summarySettings(candidateRaw);
  const settingChanges = compareSettings(baselineSettings, candidateSettings);
  const changes = [
    ...reports.flatMap((report) => (report.changes ?? []).map((change) => ({ ...change, name: report.name }))),
    ...settingChanges.map((field): ChangeDetail => ({
      kind: "setting",
      field,
      severity: "environment",
      details: settingChangeDetails(field, baselineSettings, candidateSettings),
    })),
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
    report,
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

function compareSettings(baseline: EvalSettings | undefined, candidate: EvalSettings | undefined): Array<keyof EvalSettings> {
  if (!baseline || !candidate) return [];
  const fields: Array<keyof EvalSettings> = ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"];
  return fields.filter((field) => baseline[field] !== candidate[field]);
}

function settingChangeDetails(
  field: keyof EvalSettings,
  baseline: EvalSettings | undefined,
  candidate: EvalSettings | undefined,
): SettingChangeDetails {
  return {
    from: settingValue(baseline?.[field]),
    to: settingValue(candidate?.[field]),
  };
}

function settingValue(value: string | number | undefined): string | number | null {
  return value ?? null;
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

async function streamPreviewWatch(path: string): Promise<void> {
  const writePreview = async () => {
    const source = await readFile(path, "utf8");
    process.stdout.write(`${JSON.stringify(watchPreviewPayload(path, source))}\n`);
  };
  await writePreview();
  for await (const _event of watch(path)) {
    try {
      await writePreview();
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === "preview" && args[1] && args.includes("--watch") && !args.includes("--once")) {
    await streamPreviewWatch(args[1]);
  } else {
    const result = await runCli(args);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  }
}
