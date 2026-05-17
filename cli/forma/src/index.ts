#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FormaRuntime,
  generatePythonBindings,
  generateTypeScriptBindings,
  HttpJsonProvider,
  OpenAIResponsesProvider,
  parseForma,
  StaticProvider,
} from "@forma-lang/forma";
import type { FormaDiagnostic, FormaField, FormaResult, FormaTask, FormaValue, ModelProvider } from "@forma-lang/forma";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(args: string[]): Promise<CliResult> {
  const [command, path, ...rest] = args;
  if (!command || !path || (command !== "check" && command !== "run" && command !== "eval" && command !== "eval-suite" && command !== "compare" && command !== "generate")) {
    return usage();
  }

  try {
    if (command === "compare") {
      return compareReports(path, rest[0]);
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

    const runtime = new FormaRuntime();

    if (command === "check") {
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
    const result = await runtime.runSource(source, { input, sourceName: path });
    return result.ok
      ? { exitCode: 0, stdout: `${JSON.stringify(result.output)}\n`, stderr: "" }
      : { exitCode: 1, stdout: "", stderr: `${result.error ?? "run failed"}\n` };
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: `${error instanceof Error ? error.message : String(error)}\n` };
  }
}

function usage(): CliResult {
  return { exitCode: 2, stdout: "", stderr: "usage: forma <check|run|eval|eval-suite|compare|generate> <path> [--input JSON]\n" };
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
}

async function compareReports(baselinePath: string, candidatePath: string | undefined): Promise<CliResult> {
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
  const report = {
    passed: reports.every((item) => item.passed) && regressions.length === 0,
    regressions,
    improvements,
    ...(contractChanges.length > 0 ? { contractChanges } : {}),
    ...(settingChanges.length > 0 ? { settingChanges } : {}),
    reports,
  };

  return {
    exitCode: report.passed ? 0 : 1,
    stdout: `${JSON.stringify(report, null, 2)}\n`,
    stderr: "",
  };
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
  const fields: Array<keyof EvalSettings> = ["provider", "endpoint", "model"];
  return fields.filter((field) => baseline[field] !== candidate[field]);
}

function compareReport(baseline: EvalReport | undefined, candidate: EvalReport | undefined): ReportComparison {
  const baselineChecks = new Map((baseline?.checks ?? []).map((check) => [check.name, check.passed]));
  const candidateChecks = new Map((candidate?.checks ?? []).map((check) => [check.name, check.passed]));
  const names = Array.from(new Set([...baselineChecks.keys(), ...candidateChecks.keys()])).sort();
  const regressions = names.filter((name) => baselineChecks.get(name) === true && candidateChecks.get(name) !== true);
  const improvements = names.filter((name) => baselineChecks.get(name) !== true && candidateChecks.get(name) === true);
  const contractChanges = compareContracts(baseline?.metadata?.contract, candidate?.metadata?.contract);
  return {
    name: candidate?.name || baseline?.name || "unknown",
    passed: Boolean(candidate?.passed) && regressions.length === 0,
    regressions,
    improvements,
    ...(contractChanges.length > 0 ? { contractChanges } : {}),
  };
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
}

interface EvalSettings {
  provider: EvalOptions["provider"];
  endpoint?: string;
  model?: string;
}

async function evaluateFixture(path: string, args: string[]): Promise<CliResult> {
  const report = await evaluateFixtureReport(path, args);
  return {
    exitCode: report.passed ? 0 : 1,
    stdout: `${JSON.stringify(report, null, 2)}\n`,
    stderr: "",
  };
}

async function evaluateSuite(path: string, args: string[]): Promise<CliResult> {
  const suite = JSON.parse(await readFile(path, "utf8")) as EvalSuite;
  const evalOptions = parseEvalOptions(args);
  const startedAt = Date.now();
  const reports = await Promise.all(
    suite.fixtures.map((fixturePath) => evaluateFixtureReport(resolve(dirname(path), fixturePath), args)),
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
  };
}

async function evaluateFixtureReport(path: string, args: string[]) {
  const fixture = JSON.parse(await readFile(path, "utf8")) as EvalFixture;
  const sourcePath = resolve(dirname(path), fixture.source);
  const source = await readFile(sourcePath, "utf8");
  const task = parseForma(source).tasks.find((candidate) => candidate.name === fixture.name);
  if (!task) throw new Error(`task not found in fixture source: ${fixture.name}`);
  const evalOptions = parseEvalOptions(args);
  const modelProvider = createEvalProvider(fixture, evalOptions);
  const runtime = new FormaRuntime(modelProvider ? { modelProvider } : {});
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

function parseEvalOptions(args: string[]): EvalOptions {
  const provider = optionValue(args, "--provider");
  if (!provider) return { provider: "fixture" };
  if (provider !== "http-json" && provider !== "openai-responses") {
    throw new Error(`unsupported eval provider '${provider}'`);
  }
  const model = optionValue(args, "--model") ?? (provider === "openai-responses" ? process.env.OPENAI_MODEL : undefined);
  if (!model) throw new Error(`--model is required for --provider ${provider}`);
  const apiKey = optionValue(args, "--api-key") ?? (provider === "openai-responses" ? process.env.OPENAI_API_KEY : undefined);
  if (provider === "openai-responses" && !apiKey) {
    throw new Error("--api-key is required for --provider openai-responses");
  }
  const endpoint = optionValue(args, "--endpoint");
  if (provider === "http-json" && !endpoint) {
    throw new Error("--endpoint is required for --provider http-json");
  }
  return {
    provider,
    ...(endpoint ? { endpoint } : {}),
    model,
    ...(apiKey ? { apiKey } : {}),
  };
}

function createEvalProvider(fixture: EvalFixture, options: EvalOptions): ModelProvider | undefined {
  if (options.provider === "http-json") {
    return new HttpJsonProvider({
      endpoint: options.endpoint ?? "",
      model: options.model ?? "",
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });
  }
  if (options.provider === "openai-responses") {
    return new OpenAIResponsesProvider({
      model: options.model ?? "",
      apiKey: options.apiKey ?? "",
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    });
  }
  return fixture.fakeProviderOutput ? new StaticProvider(fixture.fakeProviderOutput) : undefined;
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
