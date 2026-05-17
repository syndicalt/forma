import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { generatePythonBindings, generateTypeScriptBindings } from "../packages/forma-typescript/dist/index.js";

const required = [
  "docs/index.md",
  "docs/guides/quickstart.md",
  "docs/guides/task-authoring.md",
  "docs/guides/runtime-results.md",
  "docs/guides/provider-adapters.md",
  "docs/guides/testing-and-verification.md",
  "docs/language/overview.md",
  "docs/language/syntax.md",
  "docs/language/expressions.md",
  "docs/language/diagnostics.md",
  "docs/language/architecture.md",
  "docs/language/runtime-semantics.md",
  "docs/language/limitations.md",
  "docs/packages/python.md",
  "docs/packages/typescript.md",
  "docs/packages/cli.md",
  "docs/packages/conformance.md",
  "docs/packages/contributing.md",
  "docs/packages/registry.md",
  "packages/forma-core/schema/package.schema.json",
  "examples/review_diff.forma.pkg.json",
];

const requiredTerms = {
  "docs/language/diagnostics.md": [
    "F0001",
    "F1001",
    "F1002",
    "F1003",
    "F1004",
    "F2001",
    "F2002",
    "F3001",
    "F3002",
  ],
  "docs/language/syntax.md": [
    "task",
    "intent",
    "input",
    "output",
    "compute",
    "agent",
    "constraints",
    "verify",
  ],
  "docs/packages/python.md": ["FormaRuntime", "StaticProvider"],
  "docs/packages/typescript.md": ["FormaRuntime", "StaticProvider"],
  "docs/packages/cli.md": ["forma check", "forma run"],
  "docs/packages/registry.md": ["formaPackage", "semver", "compatibility", "evalSuite"],
  "docs/guides/quickstart.md": ["corepack pnpm", "python -m pytest", "forma run"],
  "docs/guides/task-authoring.md": ["compute", "agent", "verify"],
  "docs/guides/runtime-results.md": ["ok", "output", "trace", "diagnostics", "verification"],
  "docs/guides/provider-adapters.md": ["ModelProvider", "StaticProvider", "runAgent", "run_agent"],
  "docs/guides/testing-and-verification.md": ["docs:check", "tree-sitter test", "pytest", "vitest"],
  "docs/language/runtime-semantics.md": ["first task", "FormaResult", "verification"],
  "docs/language/limitations.md": ["MVP", "named task", "provider"],
};

const scanRoots = [
  "packages",
  "cli",
  "examples",
  "scripts",
  "README.md",
  "docs/guides",
  "docs/language",
  "docs/packages",
];

const bannedPhrases = [
  ["fixture", "-", "only"],
  ["hard", "-", "coded"],
  ["st", "ub"],
  ["fake", " success"],
  ["pretend", " pass"],
  ["TO", "DO"],
  ["T", "BD"],
  ["place", "holder"],
  ["coming", " soon"],
  ["will", " support"],
  ["not", " implemented"],
].map(phrase);

const phraseAllowlist = {
  "README.md": new Set([phrase(["fixture", "-", "only"])]),
  "docs/packages/contributing.md": new Set([phrase(["fixture", "-", "only"])]),
};

const ignoredDirs = new Set(["node_modules", "dist", "build", ".git", "__pycache__"]);

for (const path of required) {
  if (!existsSync(path)) {
    console.error(`missing ${path}`);
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  if (text.trim().length < 200) {
    console.error(`too short ${path}`);
    process.exit(1);
  }
  if (!path.endsWith(".md")) {
    continue;
  }
  for (const heading of requiredHeadings(path)) {
    if (!text.includes(heading)) {
      console.error(`missing heading ${path}: ${heading}`);
      process.exit(1);
    }
  }
  if (!hasExample(text)) {
    console.error(`missing example ${path}`);
    process.exit(1);
  }
  for (const term of requiredTerms[path] ?? []) {
    if (!text.includes(term)) {
      console.error(`missing required term ${path}: ${term}`);
      process.exit(1);
    }
  }
}

for (const path of scanFiles(scanRoots)) {
  const text = readFileSync(path, "utf8");
  for (const phrase of bannedPhrases) {
    if (isAllowed(path, phrase)) {
      continue;
    }
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      console.error(`banned phrase ${path}: ${phrase}`);
      process.exit(1);
    }
  }
}

validatePackageManifest("examples/review_diff.forma.pkg.json");

console.log("docs ok");

function hasExample(text) {
  return /```[\s\S]*?```/.test(text) || /`[^`]*(corepack|pnpm|python|forma|examples\/|packages\/)[^`]*`/.test(text);
}

function phrase(parts) {
  return parts.join("");
}

function scanFiles(paths) {
  return paths.flatMap((path) => {
    if (!existsSync(path)) {
      return [];
    }
    const stats = statSync(path);
    if (stats.isFile()) {
      return [path];
    }
    if (!stats.isDirectory()) {
      return [];
    }
    return readdirSync(path)
      .filter((entry) => !ignoredDirs.has(entry))
      .flatMap((entry) => scanFiles([join(path, entry)]))
      .sort();
  });
}

function isAllowed(path, phrase) {
  return phraseAllowlist[path]?.has(phrase) ?? false;
}

function requiredHeadings(path) {
  if (path === "docs/index.md") {
    return ["## Start Here", "## Language", "## Packages", "## Contributing"];
  }
  if (path.startsWith("docs/guides/")) {
    return ["## Purpose", "## Steps", "## Verification"];
  }
  return [];
}

function validatePackageManifest(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const manifestDir = dirname(path);
  if (manifest.formaPackage !== 1) {
    console.error(`${path}: formaPackage must be 1`);
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(manifest.name ?? "")) {
    console.error(`${path}: invalid package name`);
    process.exit(1);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
    console.error(`${path}: version must use x.y.z semver`);
    process.exit(1);
  }
  if (!Array.isArray(manifest.tasks) || manifest.tasks.length === 0) {
    console.error(`${path}: tasks must be a non-empty array`);
    process.exit(1);
  }
  for (const task of manifest.tasks) {
    for (const field of ["name", "source", "sourceSha256"]) {
      if (typeof task[field] !== "string" || task[field].length === 0) {
        console.error(`${path}: task.${field} is required`);
        process.exit(1);
      }
    }
    const sourcePath = resolve(manifestDir, task.source);
    if (!existsSync(sourcePath)) {
      console.error(`${path}: task source does not exist: ${task.source}`);
      process.exit(1);
    }
    const sourceHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
    if (sourceHash !== task.sourceSha256) {
      console.error(`${path}: task sourceSha256 does not match ${sourcePath}`);
      process.exit(1);
    }
  }
  if (typeof manifest.evalSuite !== "string" || !manifest.evalSuite.endsWith(".json")) {
    console.error(`${path}: evalSuite must point to a JSON suite`);
    process.exit(1);
  }
  if (!existsSync(resolve(manifestDir, manifest.evalSuite))) {
    console.error(`${path}: evalSuite does not exist: ${manifest.evalSuite}`);
    process.exit(1);
  }
  if (manifest.bindings !== undefined) {
    if (!Array.isArray(manifest.bindings)) {
      console.error(`${path}: bindings must be an array`);
      process.exit(1);
    }
    for (const binding of manifest.bindings) {
      if (binding.target !== "typescript" && binding.target !== "python") {
        console.error(`${path}: binding.target must be typescript or python`);
        process.exit(1);
      }
      if (typeof binding.source !== "string" || typeof binding.output !== "string") {
        console.error(`${path}: binding.source and binding.output are required`);
        process.exit(1);
      }
      const sourcePath = resolve(manifestDir, binding.source);
      const outputPath = resolve(manifestDir, binding.output);
      if (!existsSync(sourcePath) || !existsSync(outputPath)) {
        console.error(`${path}: binding source or output does not exist`);
        process.exit(1);
      }
      const source = readFileSync(sourcePath, "utf8");
      const expected = binding.target === "typescript" ? generateTypeScriptBindings(source) : generatePythonBindings(source);
      if (readFileSync(outputPath, "utf8") !== expected) {
        console.error(`${path}: generated bindings are out of date: ${binding.output}`);
        process.exit(1);
      }
    }
  }
  if (manifest.examples !== undefined) {
    if (!Array.isArray(manifest.examples)) {
      console.error(`${path}: examples must be an array`);
      process.exit(1);
    }
    for (const example of manifest.examples) {
      if (example.runtime !== "typescript" && example.runtime !== "python") {
        console.error(`${path}: example.runtime must be typescript or python`);
        process.exit(1);
      }
      if (typeof example.path !== "string" || !existsSync(resolve(manifestDir, example.path))) {
        console.error(`${path}: example.path does not exist: ${example.path}`);
        process.exit(1);
      }
    }
  }
  if (!manifest.compatibility || typeof manifest.compatibility !== "object") {
    console.error(`${path}: compatibility policy is required`);
    process.exit(1);
  }
}
