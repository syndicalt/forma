import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { generatePythonBindings, generateTypeScriptBindings } from "../packages/forma-typescript/dist/index.js";

const required = [
  "README.md",
  "docs/index.md",
  "docs/guides/quickstart.md",
  "docs/guides/task-authoring.md",
  "docs/guides/runtime-results.md",
  "docs/guides/provider-adapters.md",
  "docs/guides/product-proof.md",
  "docs/guides/first-use-audit.md",
  "docs/guides/why-forma.md",
  "docs/guides/package-consumer-quickstart.md",
  "docs/guides/testing-and-verification.md",
  "docs/guides/migrating-from-inline-prompts.md",
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
  ".github/workflows/forma-release-proof.yml",
  "packages/forma-core/schema/package.schema.json",
  "packages/forma-core/schema/package-lock.schema.json",
  "examples/README.md",
  "examples/review_diff.forma.pkg.json",
  "examples/review_diff.forma.lock.json",
  "examples/function_repair/repair_function.forma.pkg.json",
  "examples/function_repair/repair_function.forma.lock.json",
];

const requiredTerms = {
  "README.md": ["Five-Minute Usefulness Path", "inline prompt plus local schemas", "before package-review or package locks", "Before Forma", "After Forma", "duplicated host schemas", "generated TypeScript and Python bindings", "Migration Parity", "review_diff_inline", "proof:migration", "projects:check", "proof:release", "examples/review-diff-agent", "review_diff_package_lock", "package-review examples/review_diff.forma.pkg.json --proof-command", "missingMigrationParityProofCommand", "Which Scaffold Should I Use?", "docs/guides/first-use-audit.md", "first-use audit", "generated project READMEs", "project-init --minimal", "default project-init", "project-init --package-lock", "local to one application", "checked in CI", "consuming a reviewed package", "[minimal scaffold](#which-scaffold-should-i-use)", "[checked scaffold](#which-scaffold-should-i-use)", "[package-lock scaffold](#which-scaffold-should-i-use)", "product test, not an adoption commitment", "If you are skeptical, run the first-use audit before the product proof", "Keeping a local-only task out of Forma is a valid outcome", "Reusable coding-agent packages are the product wedge", "Minimal and checked projects are valid stopping points", "Package proof is not the product wedge; reusable agent contracts are", "A local prompt extraction should stop at minimal or checked scaffolds until reuse is real", "Product proof should follow first-use proof, not replace it"],
  "docs/index.md": ["Migration Parity", "review_diff_inline", "proof:migration", "projects:check", "proof:release", "examples/review-diff-agent", "package-review examples/review_diff.forma.pkg.json --proof-command", "missingMigrationParityProofCommand", "project-check --json", "docs/packages/cli.md", "docs/guides/first-use-audit.md", "first-use audit", "generated project READMEs", "five-minute usefulness path", "inline prompt plus local schemas", "project-init --minimal", "default project-init", "project-init --package-lock", "local first-use task", "checked host project", "reviewed package-lock project", "agent contract compiler", "not a prompt file format", "If you are skeptical", "Evaluate Forma as a reusable agent package workflow before adopting package locks", "Release proof is a packaging readiness check, not the first thing skeptics should run", "First-use proof asks whether host code improves, not whether packaging succeeds"],
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
  "docs/language/architecture.md": [
    "Contract, Bindings, Facade, Provider",
    ".forma contract",
    "generated bindings",
    "runtime agent facade",
    "provider adapter",
    "host application owns provider keys and model selection",
  ],
  "docs/language/overview.md": [
    ".forma file is one artifact in the contract toolchain",
    "not the whole product",
  ],
  "docs/packages/python.md": ["FormaRuntime", "StaticProvider", "Model-call execution and contract validation are separate responsibilities"],
  "docs/packages/typescript.md": ["FormaRuntime", "StaticProvider", "Model-call execution and contract validation are separate responsibilities"],
  "docs/packages/cli.md": [
    "forma check",
    "forma run",
    "forma preview",
    "preview --watch",
    "forma project-init",
    "forma project-check",
    "--minimal",
    "--package-lock",
    "smoke:lock:ts",
    "function-repair",
    "review_diff_contract.test.ts",
    "review_diff_contract_test.py",
    "missingPaths",
    "package test does not match reviewed package lock",
    "--proof-command",
    "missingMigrationParityProofCommand",
    "embedding wiring",
    "StaticProvider smoke",
    "forma-project.yml",
    "restore the generated project workflow",
    "project-check --json",
    "package-lock-smoke-tests",
    "\"missingPaths\": [\"test/review_diff_package_lock_smoke.py\"]",
    "proof:release",
    "created minimal host project",
    "created checked host project",
    "created package-lock host project",
    "Which project-init scaffold should I use?",
    "local to one application",
    "checked in CI",
    "consuming a reviewed package",
    "review_diff_migration.test.ts",
    "forma-project.yml",
    "\"missingCommands\": [\"pnpm run smoke:ts\"]",
    "packages:installed-smoke",
    "recoveryCommands",
    "triageGuide",
    "docs/guides/testing-and-verification.md#installed-package-smoke-triage",
    "the failed package kind to the restore path",
    "packageKind",
    "--check --json",
    "changedArtifactGroups",
    "\"group\": \"bindings\"",
    "Package-lock drift is a release artifact problem before it is a host application problem",
    "Stale-lock recovery starts with the package release owner",
    "notes are informational",
    "checks are blocking",
    "Fix failing checks before interpreting informational notes",
    "Scaffold proof commands",
    "minimal proof command",
    "checked proof command",
    "package-lock proof command",
    "Generated project CI is application contract protection, not framework ceremony",
    "Generated package scaffolds are release candidates, not first-use proofs",
    "`--package-lock` is for consuming a reviewed release, not proving the first task",
    "package-init is for reusable task packages, not local prompt extraction",
    "Do not publish a release candidate until a downstream consumer exists",
    "Review gates should reference a downstream consumer, not a hypothetical package audience",
    "package-review is a release gate, not a usefulness test",
    "project-check --json is for application CI dashboards",
  ],
  "docs/packages/registry.md": ["formaPackage", "semver", "compatibility", "evalSuite", "function-repair", "packages:installed-smoke", "installed package-lock consumers", "release bundle", "missingMigrationParityProofCommand", "proof:release", "review_diff_migration.test.ts", "forma-project.yml", "artifact group change", "review artifact group changes before regenerating the package lock", "--check --json", "changedArtifactGroups", "Release Notes For Artifact Group Changes", "installed-package-smoke-summary.jsonl", "\"installedPackageSmokeSummary\"", "stale-package-lock-report.json", "actions/upload-artifact"],
  "docs/guides/quickstart.md": ["corepack pnpm", "python -m pytest", "forma run", "proof:release", "projects:check", "package-review examples/review_diff.forma.pkg.json --proof-command", "missingMigrationParityProofCommand", "project-check --json", "project-check is the first CI gate", "package-review is a later release gate", "project-init ./review-diff-agent-lock", "--package-lock examples/review_diff.forma.lock.json", "smoke:lock:ts", "package-lock-smoke-tests", "missingPaths", "restore the reviewed package-lock smoke tests", "docs/packages/cli.md", "docs/guides/product-proof.md#verification", "docs/packages/cli.md#package-review-output", "Five-Minute Usefulness Path", "inline prompt plus local schemas", "assertReviewDiffOutput", "assert_review_diff_output", "before package locks", "--minimal", "before package-review or package locks", "smoke:local:ts", "review_diff_local_smoke.py", "StaticProvider", "default project-init", "checked host project", "reviewed package-lock project", "If the before/after host code is not simpler", "Move from minimal to checked only after the minimal smoke path proves", "Package locks are evidence for reusable package adoption", "A package lock should follow a named consuming application, not generic adoption anxiety", "Retries and routing are host workflow concerns after local contract proof", "Fallback models belong after the first local smoke proof"],
  "docs/guides/task-authoring.md": ["compute", "agent", "verify"],
  "docs/guides/runtime-results.md": ["ok", "output", "trace", "diagnostics", "verification", "guard between model output and host code", "Treat failed validation as a host integration bug until proven to be model behavior", "if (!result.ok)", "if not result.ok", "Log `error` with diagnostics before retrying the model", "Model fallback should retry from diagnostics, not bypass validation", "Fallback comparisons should keep both failed and replacement results", "Fallback traces are workflow evidence, not model output", "Fallback route labels should be logged with failed validation results", "Route-label evidence should not be copied into model output", "Route-label cleanup should preserve failed-result diagnostics", "Cleaned-up route labels should preserve original failure context", "Cleaned-up route labels should not overwrite trace route evidence", "Cleaned-up route labels should keep original diagnostics searchable", "Cleaned-up route labels should preserve trace search keys", "Cleaned-up route labels should preserve retry lookup keys", "Cleaned-up route labels should preserve failed-result lookup keys", "Cleaned-up route labels should preserve trace audit lookup keys", "Cleaned-up route labels should preserve trace-result audit lookup keys", "Cleaned-up route labels should preserve validation audit lookup keys", "Cleaned-up route labels should preserve diagnostics audit lookup keys", "Cleaned-up route labels should preserve diagnostics-proof audit lookup keys", "Cleaned-up route labels should preserve failed validation audit lookup keys", "Cleaned-up route labels should preserve failure-proof audit lookup keys", "Cleaned-up route labels should preserve retry-result audit lookup keys", "Cleaned-up route labels should preserve retry-attempt audit lookup keys", "Cleaned-up route labels should preserve retry-decision audit lookup keys", "Cleaned-up route labels should preserve replacement-result audit lookup keys", "Cleaned-up route labels should preserve validation-result audit lookup keys", "Cleaned-up route labels should preserve diagnostics-result audit lookup keys"],
  "docs/guides/provider-adapters.md": ["ModelProvider", "StaticProvider", "runAgent", "run_agent", "keys, model choice, routing, and retries live in host code", "Reviewed package profiles carry shared model defaults; host overrides carry deployment-specific routing and model choices", "Provider profiles are shared defaults; host overrides are deployment decisions", "Deployment overrides are host policy, not package mutation", "Fallback models are deployment policy unless every consumer should inherit them", "Fallback overrides should log the original failed result", "Fallback reruns should preserve traces across attempts", "Use local smoke providers to prove embedding shape; use production adapters to call real model services", "Production adapters prove deployment routing, not Forma usefulness", "Host retries should wrap `agent.run(...)`, not the `.forma` contract", "Fallback comparisons should happen after validation, not before", "Fallback diagnostics should be logged before route changes", "Fallback eval evidence belongs outside provider profile changes", "Fallback route labels should be stable in logs and eval artifacts", "Fallback route labels should not encode secrets", "Fallback route labels should be reviewed before becoming shared defaults", "Route labels should stay host-owned until reviewed", "Route-label cleanup should not mutate reviewed provider profiles", "Cleaned-up route labels should remain overrideable per deployment", "Cleaned-up route labels should stay decoupled from model selection", "Cleaned-up route labels should preserve reviewed provider defaults", "Cleaned-up route labels should not change provider profile ownership", "Cleaned-up route labels should preserve host override ownership", "Cleaned-up route labels should preserve deployment audit keys", "Cleaned-up route labels should preserve override audit lookup keys", "Cleaned-up route labels should preserve provider audit lookup keys", "Cleaned-up route labels should preserve provider-attempt audit lookup keys", "Cleaned-up route labels should preserve routing audit lookup keys", "Cleaned-up route labels should preserve fallback audit lookup keys", "Cleaned-up route labels should preserve fallback-attempt audit lookup keys", "Cleaned-up route labels should preserve deployment-owner audit lookup keys", "Cleaned-up route labels should preserve adapter-review audit lookup keys", "Cleaned-up route labels should preserve reviewed-default audit lookup keys", "Cleaned-up route labels should preserve provider-result audit lookup keys", "Cleaned-up route labels should preserve fallback-result audit lookup keys"],
  "docs/guides/product-proof.md": ["review_diff", "examples:check", "package-review", "eval-suite", "review_diff_inline", "review_diff_package_lock", "missingMigrationParityTests", "missingMigrationParityProofCommand", "package-lock-smoke-tests", "missingPaths", "restore the reviewed package-lock smoke tests", "proof:migration", "proof:release", "review_diff_migration.test.ts", "forma-project.yml", "Fallback smoke evidence is not a substitute for eval coverage", "Fallback eval changes need baseline comparison, not smoke-only acceptance", "Fallback baselines should identify the model route under review", "Fallback route labels should appear in candidate summaries", "Fallback route labels should be compared without exposing deployment secrets", "Route-label review is not a substitute for eval comparison", "Route-label cleanup must keep baseline and candidate artifacts comparable", "Route-label cleanup should be reviewed with eval summaries, not alone", "Cleaned-up route labels need before-and-after review context", "Cleaned-up route labels should not replace baseline route labels", "Cleaned-up route labels should not hide baseline diagnostics", "Cleaned-up route labels should keep candidate diagnostics comparable", "Cleaned-up route labels should preserve eval artifact lookup keys", "Cleaned-up route labels should preserve review audit lookup keys", "Cleaned-up route labels should preserve package-review audit lookup keys", "Cleaned-up route labels should preserve eval audit lookup keys", "Cleaned-up route labels should preserve eval-attempt audit lookup keys", "Cleaned-up route labels should preserve candidate audit lookup keys", "Cleaned-up route labels should preserve candidate-result audit lookup keys", "Cleaned-up route labels should preserve baseline audit lookup keys", "Cleaned-up route labels should preserve comparison audit lookup keys", "Cleaned-up route labels should preserve route-change audit lookup keys", "Cleaned-up route labels should preserve review-result audit lookup keys", "Cleaned-up route labels should preserve eval-result audit lookup keys"],
  "docs/guides/first-use-audit.md": ["First-Use Audit", "README.md", "docs/index.md", "docs/guides/quickstart.md", "docs/packages/cli.md", "generated minimal project README", "generated checked project README", "generated package-lock project README", "project-init --minimal", "default project-init", "project-init --package-lock", "local first-use task", "checked host project", "reviewed package-lock project", "Do not use Forma", "inline prompt plus local schemas", "Stop after the audit when the team does not need a cross-language contract", "Defer package review until one concrete consumer needs release artifacts", "No named consumer means no package lock yet", "Fallback models are not part of the usefulness proof", "Fallback comparisons belong after host-code simplification proof", "Fallback policy is not a reason to skip the minimal smoke comparison", "Fallback route testing follows, not replaces, host-code simplification", "Fallback evidence belongs after local usefulness proof", "Route-label reviews belong after first-use proof", "Route-label cleanup should not delay local smoke proof", "Route-label cleanup should not create package-review prerequisites", "Cleaned-up route labels should not obscure the first-use comparison", "Cleaned-up route labels should stay outside the usefulness decision", "Cleaned-up route labels should stay out of scaffold selection", "Cleaned-up route labels should not change the first-use proof command", "Cleaned-up route labels should not change local smoke fixture ownership", "Cleaned-up route labels should preserve local audit lookup keys", "Cleaned-up route labels should preserve local-result audit lookup keys", "Cleaned-up route labels should preserve usefulness audit lookup keys", "Cleaned-up route labels should preserve usefulness-result audit lookup keys", "Cleaned-up route labels should preserve usefulness-decision audit lookup keys", "Cleaned-up route labels should preserve adoption-proof audit lookup keys", "Cleaned-up route labels should preserve decision audit lookup keys", "Cleaned-up route labels should preserve smoke audit lookup keys", "Cleaned-up route labels should preserve smoke-attempt audit lookup keys", "Cleaned-up route labels should preserve scaffold audit lookup keys", "Cleaned-up route labels should preserve local-decision audit lookup keys", "Cleaned-up route labels should preserve proof-command audit lookup keys", "Cleaned-up route labels should preserve smoke-result audit lookup keys", "Cleaned-up route labels should preserve decision-result audit lookup keys"],
  "docs/guides/why-forma.md": ["contract layer, not prompt storage", "reviewable agent capability", "agentFromPackageLock", "agent_from_package_lock", "do not use Forma", "The minimum useful contract boundary before packaging", "The reusable package is the adoption unit", "A package is useful only when the contract is consumed outside its authoring context", "Copying `.forma` files without bindings, evals, and locks is prompt sharing"],
  "docs/guides/package-consumer-quickstart.md": [
    "agentFromPackageLock",
    "agent_from_package_lock",
    "review_diff.forma.lock.json",
    "review_diff_contract.test.ts",
    "review_diff_contract_test.py",
    "## Troubleshooting",
    "package lock is out of date",
    "provider profile apiKey or apiKeyEnv is required",
    "package test does not match reviewed package lock",
    "TypeScript",
    "Python",
    "missingMigrationParityTests",
    "missingMigrationParityProofCommand",
    "docs/guides/package-consumer-quickstart.md#missingmigrationparitytests",
    "project-init ./review-diff-agent-lock",
    "--package-lock examples/review_diff.forma.lock.json",
    "package-lock-smoke-tests",
    "missingPaths",
    "restore the reviewed package-lock smoke tests",
    "docs/guides/quickstart.md#reviewed-package-lock-projects",
    "docs/guides/product-proof.md#verification",
    "minimal host project",
    "checked host project",
    "reviewed package-lock project",
    "Not every reviewed local task should become a reusable package",
    "Do not start with package consumption",
    "Treat package-lock consumption as a dependency decision, not a starter path",
    "Lockfile consumption is for shared ownership, not local cleanup",
    "Package locks protect real handoffs, not internal file organization",
    "Package-lock smoke failures usually mean a stale reviewed artifact set",
    "Stale locks are package-owner work unless the consumer owns the reviewed release",
    "Keep diagnostics with failed package-lock smoke runs",
    "Preserve package-lock smoke evidence before retrying",
    "Fallback failures should preserve package-lock smoke evidence",
    "Package owners update reviewed locks",
    "Consume reviewed releases instead of copying package internals",
    "Copied package internals lose package-review and lock drift protection",
    "Consumer retries should wrap reviewed contracts, not patch package artifacts",
    "Pin reviewed locks before adding app-specific retries or logging",
    "Fallback models belong in host adapters unless the reviewed package default changes",
    "Fallback policy is application configuration, not reviewed artifact drift",
    "Lock regeneration should not be used to test fallback policy",
    "Fallback policy belongs with host adapters, not copied package helpers",
    "Fallback route labels should be preserved across retries",
    "Shared route-label defaults should arrive through reviewed releases",
    "Route-label cleanup belongs in host configuration before shared defaults",
    "Cleaned-up route labels should not require lock regeneration",
    "Cleaned-up route labels should remain app-owned until reviewed",
    "Cleaned-up route labels should stay local until shared release review",
    "Cleaned-up route labels should not force consumer lock updates",
    "Cleaned-up route labels should not change installed contract fixture ownership",
    "Cleaned-up route labels should preserve installed audit lookup keys",
    "Cleaned-up route labels should preserve consumer audit lookup keys",
    "Cleaned-up route labels should preserve consumer-proof audit lookup keys",
    "Cleaned-up route labels should preserve lock audit lookup keys",
    "Cleaned-up route labels should preserve lock-attempt audit lookup keys",
    "Cleaned-up route labels should preserve lock-decision audit lookup keys",
    "Cleaned-up route labels should preserve dependency audit lookup keys",
    "Cleaned-up route labels should preserve dependency-result audit lookup keys",
    "Cleaned-up route labels should preserve adoption audit lookup keys",
    "Cleaned-up route labels should preserve release-adoption audit lookup keys",
    "Cleaned-up route labels should preserve release-result audit lookup keys",
    "Cleaned-up route labels should preserve lock-update audit lookup keys",
    "Cleaned-up route labels should preserve lock-result audit lookup keys",
    "Cleaned-up route labels should preserve adoption-result audit lookup keys",
  ],
  "docs/guides/testing-and-verification.md": ["docs:check", "examples:check", "projects:check", "projects:installed-smoke", "packages:installed-smoke", "installed package-lock consumers", "release bundle", "package-install checks", "path-alias checks", "installed-project smoke CI step", "installed-package smoke CI step", "@forma-lang/forma", "forma-lang", "proof:release", "tree-sitter test", "pytest", "vitest", "proof:migration", "package-review examples/review_diff.forma.pkg.json --proof-command", "missingMigrationParityProofCommand", "project-check --json", "examples/review-diff-agent", "review_diff_migration.test.ts", "package-lock-smoke-tests", "missingPaths", "restore the reviewed package-lock smoke tests", "forma-project.yml", "missingCommands", "packageKind", "installedPackageSmokeSummary", "installedPackageSmokeFailureSummary", "expected artifact categories", "expectedArtifactFiles", "installed-package-smoke-summary.jsonl", "forma-release-proof-artifacts", "Release Artifact Reading Guide", "Installed-Package Smoke Triage", "review-diff package-lock consumer failure", "function-repair tool package failure", "reviewed package-lock project consumer failure", "Release proof validates reusable package readiness, not local adoption", "`proof:release` belongs after a named package consumer exists", "Release proof answers consumer readiness, not first-use usefulness", "`projects:check` protects application-owned contracts before package review", "Fallback retries must keep validation evidence in release artifacts", "Fallback reruns should compare against the saved failed artifact", "Fallback policy changes should stay outside package lock regeneration", "Fallback traces belong in artifacts, not lockfiles", "Fallback route changes require preserved diagnostics", "Fallback eval artifacts should travel with release proof logs", "Fallback route labels should match diagnostics and eval summaries", "Fallback route labels should remain stable across installed smoke reruns", "Route-label changes should include eval artifacts", "Route-label cleanup should preserve release proof comparability", "Route-label cleanup should leave installed smoke labels traceable", "Cleaned-up route labels should appear in proof notes when names change", "Cleaned-up route labels should remain linked to release proof artifacts", "Cleaned-up route labels should keep smoke summaries searchable", "Cleaned-up route labels should keep installed smoke failure notes comparable", "Cleaned-up route labels should preserve release proof lookup keys", "Cleaned-up route labels should preserve smoke audit lookup keys", "Cleaned-up route labels should preserve release audit lookup keys", "Cleaned-up route labels should preserve release-attempt audit lookup keys", "Cleaned-up route labels should preserve artifact audit lookup keys", "Cleaned-up route labels should preserve artifact-decision audit lookup keys", "Cleaned-up route labels should preserve installed audit lookup keys", "Cleaned-up route labels should preserve triage audit lookup keys", "Cleaned-up route labels should preserve failure-summary audit lookup keys", "Cleaned-up route labels should preserve failure-result audit lookup keys", "Cleaned-up route labels should preserve failure-attempt audit lookup keys", "Cleaned-up route labels should preserve release-proof audit lookup keys", "Cleaned-up route labels should preserve proof-result audit lookup keys", "Cleaned-up route labels should preserve release-decision audit lookup keys", "Cleaned-up route labels should preserve triage-result audit lookup keys"],
  "docs/guides/migrating-from-inline-prompts.md": [
    "inline prompt",
    ".forma",
    "agent(...)",
    "apiKeyEnv",
    "package-review",
    "--proof-command",
    "missingMigrationParityProofCommand",
    "Keep the inline prompt when it is still a one-language, one-application detail",
  ],
  "docs/language/runtime-semantics.md": ["first task", "FormaResult", "verification", "Provider output validation is part of the host trust boundary", "Runtime traces are host workflow evidence", "Fallback policy cannot turn invalid provider output into trusted data", "Fallback diagnostics are host evidence, not prompt repair instructions"],
  "docs/language/limitations.md": ["MVP", "named task", "provider"],
  "examples/README.md": ["proof:release", "corepack pnpm proof:release", "projects:check", "Each proof command answers a different adoption question"],
  ".github/workflows/forma-release-proof.yml": ["proof:release", "corepack pnpm proof:release", "installed-package-smoke-summary.jsonl", "actions/upload-artifact", "installedPackageSmokeSummary"],
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
  if (path.endsWith(".md")) {
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
validatePackageLock("examples/review_diff.forma.lock.json");
validatePackageManifest("examples/function_repair/repair_function.forma.pkg.json");
validatePackageLock("examples/function_repair/repair_function.forma.lock.json");
validateInstalledPackageSmokeScript();
validateRootPackageScripts();

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

function validateRootPackageScripts() {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const migrationProof = manifest.scripts?.["proof:migration"];
  if (typeof migrationProof !== "string") {
    console.error("package.json: missing proof:migration script");
    process.exit(1);
  }
  for (const requiredCommand of [
    "vitest run --config examples/vitest.config.ts examples/review_diff_migration.test.ts",
    "PYTHONPATH=examples python examples/review_diff_migration_test.py",
  ]) {
    if (!migrationProof.includes(requiredCommand)) {
      console.error(`package.json: proof:migration missing ${requiredCommand}`);
      process.exit(1);
    }
  }
  const projectsCheck = manifest.scripts?.["projects:check"];
  if (typeof projectsCheck !== "string") {
    console.error("package.json: missing projects:check script");
    process.exit(1);
  }
  for (const requiredCommand of [
    "node cli/forma/dist/index.js project-check examples/review-diff-agent",
    "node cli/forma/dist/index.js project-check examples/review-diff-agent --json",
    "vitest run --config examples/vitest.config.ts examples/review-diff-agent/test/review_diff_package_lock.test.ts",
    "PYTHONPATH=packages/forma-python/src python examples/review-diff-agent/test/review_diff_package_lock_smoke.py",
  ]) {
    if (!projectsCheck.includes(requiredCommand)) {
      console.error(`package.json: projects:check missing ${requiredCommand}`);
      process.exit(1);
    }
  }
  const releaseProof = manifest.scripts?.["proof:release"];
  if (typeof releaseProof !== "string") {
    console.error("package.json: missing proof:release script");
    process.exit(1);
  }
  for (const requiredCommand of [
    "node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --proof-command",
    "corepack pnpm proof:migration && corepack pnpm projects:check && corepack pnpm packages:installed-smoke",
  ]) {
    if (!releaseProof.includes(requiredCommand)) {
      console.error(`package.json: proof:release missing ${requiredCommand}`);
      process.exit(1);
    }
  }
}

function validateInstalledPackageSmokeScript() {
  const script = readFileSync("scripts/installed-package-smoke.mjs", "utf8");
  for (const requiredTerm of [
    "installedPackageSmokes",
    "installedPackageSmokeSummary",
    "installedPackageSmokeFailureSummary",
    "expectedArtifacts",
    "validateExpectedArtifactGroups",
    "expectedArtifactFiles",
    "packageKind",
    "reviewed package-lock project consumer",
    "examples/function_repair",
    "repair_function.forma.pkg.json",
    "repair_function.forma.lock.json",
    "repair_function",
  ]) {
    if (!script.includes(requiredTerm)) {
      console.error(`scripts/installed-package-smoke.mjs: missing ${requiredTerm}`);
      process.exit(1);
    }
  }
}

function requiredHeadings(path) {
  if (path === "docs/index.md") {
    return ["## Start Here", "## Language", "## Packages", "## Contributing"];
  }
  if (path.startsWith("docs/guides/")) {
    return ["## Purpose", "## Steps", "## Verification"];
  }
  if (path === "docs/packages/cli.md") {
    return ["## Release Runtime Flow"];
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
  if (manifest.tests !== undefined) {
    if (!Array.isArray(manifest.tests)) {
      console.error(`${path}: tests must be an array`);
      process.exit(1);
    }
    for (const test of manifest.tests) {
      if (test.runtime !== "typescript" && test.runtime !== "python") {
        console.error(`${path}: test.runtime must be typescript or python`);
        process.exit(1);
      }
      if (typeof test.path !== "string" || !existsSync(resolve(manifestDir, test.path))) {
        console.error(`${path}: test.path does not exist: ${test.path}`);
        process.exit(1);
      }
    }
  }
  if (manifest.releaseFiles !== undefined) {
    if (!Array.isArray(manifest.releaseFiles)) {
      console.error(`${path}: releaseFiles must be an array`);
      process.exit(1);
    }
    for (const file of manifest.releaseFiles) {
      if (typeof file.path !== "string" || !existsSync(resolve(manifestDir, file.path))) {
        console.error(`${path}: releaseFiles.path does not exist: ${file.path}`);
        process.exit(1);
      }
    }
  }
  if (manifest.providerProfile !== undefined) {
    if (typeof manifest.providerProfile !== "string" || !manifest.providerProfile.endsWith(".json")) {
      console.error(`${path}: providerProfile must point to a JSON file`);
      process.exit(1);
    }
    const profilePath = resolve(manifestDir, manifest.providerProfile);
    if (!existsSync(profilePath)) {
      console.error(`${path}: providerProfile does not exist: ${manifest.providerProfile}`);
      process.exit(1);
    }
    const profile = JSON.parse(readFileSync(profilePath, "utf8"));
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      console.error(`${path}: providerProfile must contain a JSON object`);
      process.exit(1);
    }
    if (profile.provider !== "http-json" && profile.provider !== "openai-responses") {
      console.error(`${path}: providerProfile.provider must be http-json or openai-responses`);
      process.exit(1);
    }
    if (profile.provider === "http-json" && typeof profile.endpoint !== "string") {
      console.error(`${path}: providerProfile.endpoint is required for http-json`);
      process.exit(1);
    }
    if (typeof profile.model !== "string" || profile.model.length === 0) {
      console.error(`${path}: providerProfile.model is required`);
      process.exit(1);
    }
    if (profile.apiKey !== undefined && typeof profile.apiKey !== "string") {
      console.error(`${path}: providerProfile.apiKey must be a string`);
      process.exit(1);
    }
    if (profile.apiKeyEnv !== undefined && typeof profile.apiKeyEnv !== "string") {
      console.error(`${path}: providerProfile.apiKeyEnv must be a string`);
      process.exit(1);
    }
  }
  if (!manifest.compatibility || typeof manifest.compatibility !== "object") {
    console.error(`${path}: compatibility policy is required`);
    process.exit(1);
  }
}

function validatePackageLock(path) {
  const lock = JSON.parse(readFileSync(path, "utf8"));
  const lockDir = dirname(path);
  if (lock.formaPackageLock !== 1) {
    console.error(`${path}: formaPackageLock must be 1`);
    process.exit(1);
  }
  if (!lock.package || typeof lock.package !== "object") {
    console.error(`${path}: package lock metadata is required`);
    process.exit(1);
  }
  const manifestPath = resolve(lockDir, lock.package.manifest);
  if (!existsSync(manifestPath)) {
    console.error(`${path}: locked manifest does not exist: ${lock.package.manifest}`);
    process.exit(1);
  }
  if (sha256(manifestPath) !== lock.package.manifestSha256) {
    console.error(`${path}: manifest hash does not match: ${lock.package.manifest}`);
    process.exit(1);
  }
  for (const task of lock.tasks ?? []) {
    assertLockedHash(path, lockDir, task.source, task.sourceSha256, "task source");
  }
  if (lock.evalSuite) {
    assertLockedHash(path, lockDir, lock.evalSuite.path, lock.evalSuite.sha256, "eval suite");
  }
  if (lock.providerProfile) {
    assertLockedHash(path, lockDir, lock.providerProfile.path, lock.providerProfile.sha256, "provider profile");
    if ("apiKey" in lock.providerProfile) {
      console.error(`${path}: lockfile must not store provider apiKey`);
      process.exit(1);
    }
  }
  for (const binding of lock.bindings ?? []) {
    assertLockedHash(path, lockDir, binding.output, binding.sha256, "binding");
  }
  for (const example of lock.examples ?? []) {
    assertLockedHash(path, lockDir, example.path, example.sha256, "example");
  }
  for (const test of lock.tests ?? []) {
    assertLockedHash(path, lockDir, test.path, test.sha256, "test");
  }
  for (const file of lock.releaseFiles ?? []) {
    assertLockedHash(path, lockDir, file.path, file.sha256, "release file");
  }
}

function assertLockedHash(lockPath, lockDir, artifactPath, expectedHash, label) {
  if (typeof artifactPath !== "string" || typeof expectedHash !== "string") {
    console.error(`${lockPath}: ${label} path and hash are required`);
    process.exit(1);
  }
  const resolved = resolve(lockDir, artifactPath);
  if (!existsSync(resolved)) {
    console.error(`${lockPath}: locked ${label} does not exist: ${artifactPath}`);
    process.exit(1);
  }
  if (sha256(resolved) !== expectedHash) {
    console.error(`${lockPath}: locked ${label} hash does not match: ${artifactPath}`);
    process.exit(1);
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
