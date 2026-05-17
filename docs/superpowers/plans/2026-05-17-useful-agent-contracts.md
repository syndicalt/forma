# Useful Agent Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Forma useful as a portable agent task contract by adding named task execution, output validation, examples, and docs.

**Architecture:** Keep `.forma` as the task contract and keep provider credentials/model selection in host code. The TypeScript and Python runtimes parse all task declarations, select a named task when requested, validate provider or compute output against the declared output block, then run existing `verify` rules. Shared examples and docs show the same embedding shape in both runtimes.

**Tech Stack:** TypeScript, Vitest, Python, pytest, Tree-sitter corpus, Markdown docs, existing Forma parser/runtime packages.

---

### Task 1: Named Task Execution

**Files:**
- Modify: `packages/forma-typescript/test/runtime.test.ts`
- Modify: `packages/forma-python/tests/test_runtime.py`
- Modify: `packages/forma-typescript/src/parser.ts`
- Modify: `packages/forma-python/src/forma/parser.py`
- Modify: `packages/forma-typescript/src/runtime.ts`
- Modify: `packages/forma-python/src/forma/runtime.py`

- [ ] Write failing TypeScript and Python tests for `runTask` / `run_task` selecting the second task in a source file.
- [ ] Run focused tests and confirm they fail because the new APIs do not exist or the parser only returns one task.
- [ ] Parse multiple task declarations into `FormaProgram.tasks`.
- [ ] Add `runTask(source, taskName, options)` and `run_task(source, task_name, input, source_name)` without changing existing `runSource` / `run_source` behavior.
- [ ] Run focused tests and confirm they pass.

### Task 2: Output Contract Validation

**Files:**
- Modify: `packages/forma-typescript/test/runtime.test.ts`
- Modify: `packages/forma-python/tests/test_runtime.py`
- Modify: `packages/forma-typescript/src/evaluator.ts`
- Modify: `packages/forma-python/src/forma/evaluator.py`
- Modify: `docs/language/diagnostics.md`

- [ ] Write failing tests where an agent provider returns `{}` for a task that declares `message: Text`.
- [ ] Run focused tests and confirm runtime currently reports verification failure rather than an output contract error.
- [ ] Add output validation for required fields and MVP `Text` values before `verify` runs.
- [ ] Return stable runtime error codes for missing required output and wrong output type.
- [ ] Document the new diagnostic/runtime codes.
- [ ] Run focused tests and confirm they pass.

### Task 3: Examples And Docs

**Files:**
- Create: `examples/embedded-agent.ts`
- Create: `examples/embedded_agent.py`
- Modify: `docs/index.md`
- Modify: `docs/language/overview.md`
- Modify: `docs/language/runtime-semantics.md`
- Modify: `docs/guides/provider-adapters.md`
- Modify: `docs/packages/typescript.md`
- Modify: `docs/packages/python.md`
- Modify: `README.md`

- [ ] Add TypeScript and Python examples showing `.forma` source loading, provider construction, model/key placement, named task execution, and result handling.
- [ ] Update docs to explain the problem Forma solves before describing package APIs.
- [ ] Update runtime docs to include output validation order.
- [ ] Run `corepack pnpm docs:check` and fix any documentation gate failures.

### Task 4: Verification And Commit

**Files:**
- All changed files.

- [ ] Run `corepack pnpm docs:check`.
- [ ] Run `corepack pnpm check`.
- [ ] Run `corepack pnpm test`.
- [ ] Run `python -m pytest packages/forma-python/tests -q`.
- [ ] Commit and push the finished slice to `main`.
