# Golden Workflow

## Purpose

The golden workflow is the path for evaluating Forma as an agent coding
contract layer. It starts with the `review_diff first-use path`, moves to the
`function_repair coding-agent showcase`, and reaches package review only after
local usefulness is proven.

## Steps

### Stage 1: review_diff first-use path

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

### Stage 2: function_repair coding-agent showcase

Use this stage after the first-use path proves the contract boundary. The
`function_repair` task demonstrates a narrow coding-agent workflow with
read/search/edit/test trace evidence.

The showcase edits one named function and runs one focused test command. The
host owns tool implementations and decides which read, search, edit, and test
requests are allowed.

### Stage 3: compact proof report

The compact proof report should summarize workflow name, task name, commands,
validation status, diagnostics, trace summary, and the next gate. The next gate
is one of: stop local, add checked project CI, or package review.

### Stage 4: package review comes after local usefulness

Package review and package locks are downstream adoption evidence. Use them
when a named consumer should depend on a reviewed task package, not as the first
step in evaluating Forma.

## Verification

The local proof is healthy when the `review_diff` minimal smoke commands pass,
the `function_repair` coding-agent showcase records read/search/edit/test trace
evidence, and package review stays downstream from the local usefulness
decision.
