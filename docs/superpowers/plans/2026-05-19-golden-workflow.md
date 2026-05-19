# Golden Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staged golden workflow where `review_diff` proves ten-minute first-use value and `function_repair` proves typed, permissioned coding-agent repair with inspectable trace evidence.

**Architecture:** Reuse the existing CLI, examples, docs, and smoke-test structure. Pin the product story with docs guards first, then tighten `review_diff` local proof, then make `function_repair` a concrete tool-using smoke workflow, then add a compact local proof report command that summarizes validation, diagnostics, traces, commands, and the next gate.

**Tech Stack:** TypeScript, Vitest, Python, Markdown docs, `scripts/check-docs.mjs`, `cli/forma/src/index.ts`, existing Forma runtime traces and generated bindings.

---

## File Structure

- Create `docs/guides/golden-workflow.md`: user-facing guide through `review_diff`, `function_repair`, and packaging handoff.
- Modify `scripts/check-docs.mjs`: require the new guide and golden workflow vocabulary.
- Modify `docs/index.md`, `docs/guides/quickstart.md`, `docs/guides/product-proof.md`, `docs/guides/first-use-audit.md`, and `docs/guides/package-consumer-quickstart.md`: link to the golden workflow in the correct order.
- Modify `README.md`: make the golden workflow visible from the first-use section.
- Modify `examples/function_repair/README.md`: explain the concrete repair fixture and tool trace proof.
- Create `examples/function_repair/fixtures/billing.ts` and `examples/function_repair/fixtures/billing.py`: small broken functions for deterministic repair smoke tests.
- Create `examples/function_repair/fixtures/billing.test.ts` and `examples/function_repair/fixtures/test_billing.py`: focused tests that describe the expected behavior.
- Create `examples/function_repair/repair_function_trace.test.ts` and `examples/function_repair/repair_function_trace_test.py`: tests proving read/search/edit/test trace evidence.
- Modify `examples/function_repair/repair_function_package.ts` and `examples/function_repair/repair_function_package.py`: replace generic `NEEDS_FIX` replacement with concrete fixture-aware repair logic for smoke proof.
- Modify `examples/function_repair/repair_function.forma.pkg.json`, `examples/function_repair/repair_function.forma.lock.json`, `scripts/installed-package-smoke.mjs`, and `package.json`: include the new repair trace tests in package review and installed smoke coverage.
- Modify `cli/forma/src/index.ts`: add a `golden-proof` command that emits compact local proof JSON.
- Modify `cli/forma/test/cli.test.ts`: add focused tests for the new `golden-proof` command.
- Modify `docs/packages/cli.md`, `examples/README.md`, and package docs for the new proof command.

## Task 1: Pin The Golden Workflow Guide

**Files:**
- Create: `docs/guides/golden-workflow.md`
- Modify: `scripts/check-docs.mjs`
- Modify: `docs/index.md`
- Modify: `README.md`
- Modify: `docs/guides/quickstart.md`
- Modify: `docs/guides/product-proof.md`
- Modify: `docs/guides/first-use-audit.md`
- Modify: `docs/guides/package-consumer-quickstart.md`

- [ ] **Step 1: Write the failing docs guard**

Add `docs/guides/golden-workflow.md` to the `required` array in `scripts/check-docs.mjs`.

Add this required term list:

```js
"docs/guides/golden-workflow.md": [
  "Golden Workflow",
  "review_diff first-use path",
  "function_repair coding-agent showcase",
  "ten-minute local proof",
  "inline prompt plus local schemas",
  "generated TypeScript and Python bindings",
  "read/search/edit/test trace evidence",
  "compact proof report",
  "package review comes after local usefulness",
],
```

- [ ] **Step 2: Run docs check to verify it fails**

Run:

```bash
corepack pnpm docs:check
```

Expected: FAIL with missing required file `docs/guides/golden-workflow.md`.

- [ ] **Step 3: Add the golden workflow guide**

Create `docs/guides/golden-workflow.md`:

```markdown
# Golden Workflow

The golden workflow is the path for evaluating Forma as an agent coding
contract layer. It starts with the `review_diff first-use path`, moves to the
`function_repair coding-agent showcase`, and reaches package review only after
local usefulness is proven.

## Stage 1: review_diff first-use path

Use this stage to decide whether a `.forma` contract is clearer than an inline
prompt plus local schemas.

```bash
forma project-init ./review-diff-agent-minimal \
  --name review-diff-agent-minimal \
  --task review_diff \
  --minimal
cd review-diff-agent-minimal
pnpm run smoke:local:ts
python test/review_diff_local_smoke.py
```

The ten-minute local proof is the generated project plus local smoke output:
the `.forma` contract owns task shape, generated TypeScript and Python bindings
validate output, and host code keeps provider setup local.

Compare that with `examples/review_diff_inline.ts` and
`examples/review_diff_inline.py`. If the generated contract boundary is not
simpler than inline prompt plus local schemas, stop here.

## Stage 2: function_repair coding-agent showcase

Use this stage after the first-use path proves the contract boundary. The
`function_repair` task demonstrates a narrow coding-agent workflow with
read/search/edit/test trace evidence.

The showcase edits one named function and runs one focused test command. The
host owns tool implementations and decides which read, search, edit, and test
requests are allowed.

## Stage 3: compact proof report

The compact proof report should summarize workflow name, task name, commands,
validation status, diagnostics, trace summary, and the next gate. The next gate
is one of: stop local, add checked project CI, or package review.

## Stage 4: package review comes after local usefulness

Package review and package locks are downstream adoption evidence. Use them
when a named consumer should depend on a reviewed task package, not as the first
step in evaluating Forma.
```

- [ ] **Step 4: Link the guide from existing docs**

Add one sentence with `docs/guides/golden-workflow.md` to:

```markdown
README.md
docs/index.md
docs/guides/quickstart.md
docs/guides/product-proof.md
docs/guides/first-use-audit.md
docs/guides/package-consumer-quickstart.md
```

Use wording that preserves the order: `review_diff` first, `function_repair`
second, package review last.

- [ ] **Step 5: Run docs check to verify it passes**

Run:

```bash
corepack pnpm docs:check
```

Expected: PASS with `docs ok`.

- [ ] **Step 6: Commit**

```bash
git add docs/guides/golden-workflow.md scripts/check-docs.mjs README.md docs/index.md docs/guides/quickstart.md docs/guides/product-proof.md docs/guides/first-use-audit.md docs/guides/package-consumer-quickstart.md
git commit -m "docs: add golden workflow guide"
```

## Task 2: Protect The Review Diff Ten-Minute Proof

**Files:**
- Modify: `scripts/installed-project-smoke.mjs`
- Modify: `docs/guides/golden-workflow.md`
- Modify: `README.md`
- Modify: `docs/guides/quickstart.md`
- Modify: `docs/packages/cli.md`

- [ ] **Step 1: Write the failing installed project smoke assertion**

In `scripts/installed-project-smoke.mjs`, extend the installed project smoke to create and run a minimal project before the existing checked project smoke.

Add an assertion helper:

```js
async function assertFileContains(path, terms) {
  const text = await readFile(path, "utf8");
  const missing = terms.filter((term) => !text.includes(term));
  if (missing.length > 0) {
    throw new Error(`${relative(repoRoot, path)} missing ${missing.join(", ")}`);
  }
}
```

In the minimal-project branch, assert generated files mention:

```js
await assertFileContains(join(projectDir, "README.md"), [
  "ten-minute local proof",
  "inline prompt plus local schemas",
  "pnpm run smoke:local:ts",
  "python test/review_diff_local_smoke.py",
]);
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
corepack pnpm projects:installed-smoke
```

Expected: FAIL because the generated minimal README does not yet include `ten-minute local proof`.

- [ ] **Step 3: Update minimal scaffold README text**

In `cli/forma/src/index.ts`, update `scaffoldProjectReadme(...)` for `minimal === true` to include:

```markdown
This is the ten-minute local proof. It should show whether Forma is clearer
than inline prompt plus local schemas before package-review or package locks.

Run both local smoke commands:

```bash
pnpm run smoke:local:ts
python test/review_diff_local_smoke.py
```
```

Also link to `docs/guides/golden-workflow.md`.

- [ ] **Step 4: Run focused verification**

Run:

```bash
corepack pnpm --filter @forma-lang/cli build
corepack pnpm projects:installed-smoke
```

Expected: PASS, with the minimal smoke commands and existing checked project smoke succeeding.

- [ ] **Step 5: Update docs that describe the scaffold**

Update `docs/guides/golden-workflow.md`, `README.md`, `docs/guides/quickstart.md`, and `docs/packages/cli.md` so the minimal scaffold is consistently called the `ten-minute local proof`.

- [ ] **Step 6: Run docs check**

Run:

```bash
corepack pnpm docs:check
```

Expected: PASS with `docs ok`.

- [ ] **Step 7: Commit**

```bash
git add scripts/installed-project-smoke.mjs cli/forma/src/index.ts docs/guides/golden-workflow.md README.md docs/guides/quickstart.md docs/packages/cli.md
git commit -m "feat: protect review diff local proof"
```

## Task 3: Make Function Repair A Concrete Tool Workflow

**Files:**
- Create: `examples/function_repair/fixtures/billing.ts`
- Create: `examples/function_repair/fixtures/billing.py`
- Create: `examples/function_repair/fixtures/billing.test.ts`
- Create: `examples/function_repair/fixtures/test_billing.py`
- Create: `examples/function_repair/repair_function_trace.test.ts`
- Create: `examples/function_repair/repair_function_trace_test.py`
- Modify: `examples/function_repair/repair_function_package.ts`
- Modify: `examples/function_repair/repair_function_package.py`
- Modify: `examples/function_repair/README.md`
- Modify: `examples/function_repair/repair_function.forma.pkg.json`
- Modify: `examples/function_repair/repair_function.forma.lock.json`
- Modify: `scripts/installed-package-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the TypeScript failing trace test**

Create `examples/function_repair/repair_function_trace.test.ts`:

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repairFunctionAgent } from "./repair_function_package.js";

describe("repair_function golden workflow trace", () => {
  it("repairs one named TypeScript function through read/search/edit/test tools", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-repair-ts-"));
    const sourcePath = join(dir, "billing.ts");
    const trace: string[] = [];
    await writeFile(sourcePath, "export function calculateTotal(subtotal: number, discount: number): number {\\n  return subtotal;\\n}\\n", "utf8");

    const agent = repairFunctionAgent({
      readText: async (path) => {
        trace.push(`read:${path}`);
        return readFile(path, "utf8");
      },
      searchText: async (query) => {
        trace.push(`search:${query}`);
        return [sourcePath];
      },
      writeText: async (path, content) => {
        trace.push(`edit:${path}`);
        await writeFile(path, content, "utf8");
        return { ok: true, output: "wrote billing.ts" };
      },
      runTest: async (command) => {
        trace.push(`test:${command}`);
        return { ok: true, output: "billing test passed" };
      },
    });

    const result = await agent.run({
      path: sourcePath,
      function_name: "calculateTotal",
      desired_behavior: "Return subtotal minus discount.",
      test_command: "pnpm test -- billing",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({
      function_name: "calculateTotal",
      test_passed: true,
      edited: true,
    });
    expect(await readFile(sourcePath, "utf8")).toContain("subtotal - discount");
    expect(trace).toEqual([
      `read:${sourcePath}`,
      "search:calculateTotal",
      `edit:${sourcePath}`,
      "test:pnpm test -- billing",
    ]);
  });
});
```

- [ ] **Step 2: Run the TypeScript test to verify it fails**

Run:

```bash
corepack pnpm --filter @forma-lang/forma build
corepack pnpm exec vitest run --config examples/vitest.config.ts examples/function_repair/repair_function_trace.test.ts
```

Expected: FAIL because `repairFunctionAgent` is not exported or does not perform the concrete repair.

- [ ] **Step 3: Write the Python failing trace test**

Create `examples/function_repair/repair_function_trace_test.py`:

```python
from pathlib import Path
from tempfile import TemporaryDirectory

from repair_function_package import repair_function_agent


def test_repairs_one_named_python_function_through_tools():
    with TemporaryDirectory() as tmp:
        source_path = Path(tmp) / "billing.py"
        source_path.write_text("def calculate_total(subtotal: int, discount: int) -> int:\\n    return subtotal\\n", encoding="utf8")
        trace: list[str] = []

        class Tools:
            def read_text(self, path: str) -> str:
                trace.append(f"read:{path}")
                return Path(path).read_text(encoding="utf8")

            def search_text(self, query: str) -> list[str]:
                trace.append(f"search:{query}")
                return [str(source_path)]

            def write_text(self, path: str, content: str) -> dict[str, object]:
                trace.append(f"edit:{path}")
                Path(path).write_text(content, encoding="utf8")
                return {"ok": True, "output": "wrote billing.py"}

            def run_test(self, command: str) -> dict[str, object]:
                trace.append(f"test:{command}")
                return {"ok": True, "output": "billing test passed"}

        agent = repair_function_agent(tools=Tools())
        result = agent.run({
            "path": str(source_path),
            "function_name": "calculate_total",
            "desired_behavior": "Return subtotal minus discount.",
            "test_command": "pytest tests/test_billing.py",
        })

        assert result.ok
        assert result.output["function_name"] == "calculate_total"
        assert result.output["test_passed"] is True
        assert result.output["edited"] is True
        assert "subtotal - discount" in source_path.read_text(encoding="utf8")
        assert trace == [
            f"read:{source_path}",
            "search:calculate_total",
            f"edit:{source_path}",
            "test:pytest tests/test_billing.py",
        ]
```

- [ ] **Step 4: Run the Python test to verify it fails**

Run:

```bash
PYTHONPATH=examples/function_repair:packages/forma-python/src python examples/function_repair/repair_function_trace_test.py
```

Expected: FAIL because `repair_function_agent` is not exported or does not perform the concrete repair.

- [ ] **Step 5: Implement concrete repair helpers**

In `examples/function_repair/repair_function_package.ts`, export `repairFunctionAgent(tools)` and update `FunctionRepairProvider` to:

```ts
const repaired = source.replace("return subtotal;", "return subtotal - discount;");
await input.tools.searchText(functionName);
await input.tools.writeText(path, repaired);
const test = await input.tools.runTest(testCommand);
```

Keep `runRepairFunction()` as the package example entrypoint and make it call the new helper.

In `examples/function_repair/repair_function_package.py`, export `repair_function_agent(tools=None)` and update the provider to:

```python
repaired = source.replace("return subtotal", "return subtotal - discount")
tools.search_text(function_name)
tools.write_text(path, repaired)
test = tools.run_test(test_command)
```

Keep `run_repair_function()` as the package example entrypoint and make it call the new helper.

- [ ] **Step 6: Add concrete fixture files**

Create `examples/function_repair/fixtures/billing.ts`:

```ts
export function calculateTotal(subtotal: number, discount: number): number {
  return subtotal;
}
```

Create `examples/function_repair/fixtures/billing.test.ts`:

```ts
import { expect, it } from "vitest";
import { calculateTotal } from "./billing.js";

it("applies discounts", () => {
  expect(calculateTotal(100, 15)).toBe(85);
});
```

Create `examples/function_repair/fixtures/billing.py`:

```python
def calculate_total(subtotal: int, discount: int) -> int:
    return subtotal
```

Create `examples/function_repair/fixtures/test_billing.py`:

```python
from billing import calculate_total


def test_applies_discounts():
    assert calculate_total(100, 15) == 85
```

- [ ] **Step 7: Run focused tests to verify they pass**

Run:

```bash
corepack pnpm --filter @forma-lang/forma build
corepack pnpm exec vitest run --config examples/vitest.config.ts examples/function_repair/repair_function_trace.test.ts
PYTHONPATH=examples/function_repair:packages/forma-python/src python examples/function_repair/repair_function_trace_test.py
```

Expected: PASS.

- [ ] **Step 8: Add package and smoke coverage**

Update `examples/function_repair/repair_function.forma.pkg.json` to add a `tests` array after `examples`:

```json
"tests": [
  {
    "runtime": "typescript",
    "path": "repair_function_trace.test.ts"
  },
  {
    "runtime": "python",
    "path": "repair_function_trace_test.py"
  }
],
```

Add fixture files to `releaseFiles` so the package bundle and lock record the concrete repair proof:

```json
{
  "path": "fixtures/billing.ts"
},
{
  "path": "fixtures/billing.test.ts"
},
{
  "path": "fixtures/billing.py"
},
{
  "path": "fixtures/test_billing.py"
}
```

Regenerate or update `examples/function_repair/repair_function.forma.lock.json` with:

```bash
node cli/forma/dist/index.js package-lock examples/function_repair/repair_function.forma.pkg.json --output examples/function_repair/repair_function.forma.lock.json
```

Update `scripts/installed-package-smoke.mjs` so the function-repair package bundle includes the trace tests and fixtures, and so the installed smoke runs:

```bash
corepack pnpm exec vitest run repair_function_installed.test.ts repair_function_trace.test.ts
```

Update `package.json` `examples:check` so it runs or compiles the new TypeScript and Python trace tests.

- [ ] **Step 9: Run focused package checks**

Run:

```bash
corepack pnpm examples:check
node cli/forma/dist/index.js package-review examples/function_repair/repair_function.forma.pkg.json
corepack pnpm packages:installed-smoke
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add examples/function_repair package.json scripts/installed-package-smoke.mjs
git commit -m "feat: make function repair a golden workflow"
```

## Task 4: Add Compact Golden Proof Report

**Files:**
- Modify: `cli/forma/src/index.ts`
- Modify: `cli/forma/test/cli.test.ts`
- Modify: `docs/packages/cli.md`
- Modify: `docs/guides/golden-workflow.md`
- Modify: `examples/README.md`
- Modify: `scripts/check-docs.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing CLI test**

Add this test to `cli/forma/test/cli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "../src/index.js";

describe("golden-proof", () => {
  it("summarizes review_diff and function_repair proof gates", async () => {
    const result = await runCli(["golden-proof", "examples"]);
    expect(result.exitCode).toBe(0);
    const proof = JSON.parse(result.stdout);
    expect(proof).toMatchObject({
      passed: true,
      workflows: [
        {
          name: "review_diff first-use path",
          task: "review_diff",
          nextGate: "stop local or add checked project CI",
        },
        {
          name: "function_repair coding-agent showcase",
          task: "repair_function",
          nextGate: "package review after local usefulness",
        },
      ],
    });
    expect(proof.workflows[0].commands).toContain("pnpm run smoke:local:ts");
    expect(proof.workflows[1].traceSummary).toEqual(["read", "search", "edit", "test"]);
  });
});
```

- [ ] **Step 2: Run the CLI test to verify it fails**

Run:

```bash
corepack pnpm --filter @forma-lang/cli test -- golden-proof
```

Expected: FAIL because `golden-proof` is not accepted by `runCli`.

- [ ] **Step 3: Implement `golden-proof` command**

In `cli/forma/src/index.ts`, add `golden-proof` to the accepted command list and usage string.

Add a handler before source-file commands:

```ts
if (command === "golden-proof") {
  return goldenProof(path);
}
```

Add:

```ts
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
```

Keep this command deterministic. It summarizes the local proof shape; it does not run `proof:release`.

- [ ] **Step 4: Run focused CLI verification**

Run:

```bash
corepack pnpm --filter @forma-lang/cli test -- golden-proof
corepack pnpm --filter @forma-lang/cli build
node cli/forma/dist/index.js golden-proof examples
```

Expected: PASS and JSON includes both workflow names, commands, validation, diagnostics, trace summary, and next gate.

- [ ] **Step 5: Document the command and guard it**

Add required terms to `scripts/check-docs.mjs` for `docs/packages/cli.md` and `docs/guides/golden-workflow.md`:

```js
"forma golden-proof examples",
"review_diff first-use path",
"function_repair coding-agent showcase",
"nextGate",
"traceSummary",
```

Update `docs/packages/cli.md`, `docs/guides/golden-workflow.md`, and `examples/README.md` with:

```bash
forma golden-proof examples
```

Explain that `golden-proof` is the local reviewer summary and `proof:release` remains the reusable package release gate.

- [ ] **Step 6: Run docs and CLI checks**

Run:

```bash
corepack pnpm docs:check
corepack pnpm --filter @forma-lang/cli test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cli/forma/src/index.ts cli/forma/test/cli.test.ts docs/packages/cli.md docs/guides/golden-workflow.md examples/README.md scripts/check-docs.mjs package.json
git commit -m "feat: add golden proof report"
```

## Task 5: Full Gate And Release-Proof Alignment

**Files:**
- Review: all files changed by Tasks 1-4.
- Modify only the files named in Tasks 1-4 if the full proof gate exposes an integration issue.

- [ ] **Step 1: Run the full proof gate**

Run:

```bash
corepack pnpm docs:check && git diff --check && corepack pnpm proof:release
```

Expected: PASS. The `package-review` JSON should include `"passed": true`.

- [ ] **Step 2: Review changed files**

Run:

```bash
git status --short --branch
git diff --stat
git diff -- README.md docs/guides/golden-workflow.md docs/guides/quickstart.md docs/packages/cli.md examples/function_repair cli/forma/src/index.ts scripts/check-docs.mjs package.json
```

Expected: only golden workflow, function repair, CLI proof, docs, smoke, and manifest/lock changes are present. Leave `.eventloom/` untracked.

- [ ] **Step 3: Commit any final fixes**

If Step 1 or Step 2 required fixes:

```bash
git add README.md docs/guides/golden-workflow.md docs/guides/quickstart.md docs/packages/cli.md examples/README.md examples/function_repair cli/forma/src/index.ts cli/forma/test/cli.test.ts scripts/check-docs.mjs scripts/installed-project-smoke.mjs scripts/installed-package-smoke.mjs package.json
git commit -m "test: align golden workflow proof gate"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 4: Push**

Run:

```bash
git push
git status --short --branch
git log --oneline -5
```

Expected: branch is up to date with `origin/main`, with only `.eventloom/` untracked.
