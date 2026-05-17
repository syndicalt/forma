# Registry And Versioning

Forma package manifests describe a versioned task contract that can be reviewed,
evaluated, and depended on from TypeScript or Python repositories. The first
manifest schema lives at `packages/forma-core/schema/package.schema.json`.

## Manifest

Use `formaPackage: 1` to identify the manifest format. The package `name` is a
stable registry identifier, and `version` uses semver. Each task entry records
the task name, source path, and source SHA-256 so hosts can detect contract
drift before runtime. `evalSuite` points at the suite that should be archived
with releases. Optional `bindings` entries point at checked-in generated
TypeScript or Python binding files. Optional `examples` entries point at host
embedding examples that show provider setup, `agent(...)`, generated output
validators, and result handling. Manifest paths are resolved relative to the
package manifest file.

```json
{
  "formaPackage": 1,
  "name": "examples/review-diff",
  "version": "0.1.0",
  "tasks": [
    {
      "name": "review_diff",
      "source": "review_diff.forma",
      "sourceSha256": "9ccf780f57f35f54f4da21291075f7728dcb530442efebc603c50073e580e9ec"
    }
  ],
  "evalSuite": "forma.eval.json",
  "bindings": [
    {
      "target": "typescript",
      "source": "review_diff.forma",
      "output": "review_diff.forma.ts"
    },
    {
      "target": "python",
      "source": "review_diff.forma",
      "output": "review_diff_forma.py"
    }
  ],
  "examples": [
    {
      "runtime": "typescript",
      "path": "review_diff_package.ts"
    },
    {
      "runtime": "python",
      "path": "review_diff_package.py"
    }
  ]
}
```

## Compatibility

The `compatibility` section names the fields that map to compare severities.
Use the same vocabulary as `forma compare --fail-on`: `breaking`, `review`, and
`environment`.

```json
{
  "compatibility": {
    "breaking": ["input", "output", "schemas"],
    "review": ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples"],
    "environment": ["provider", "endpoint", "model"]
  }
}
```

Semver policy:

- Patch releases keep the manifest task set and all required input/output fields
  compatible.
- Minor releases may add optional output fields, new review-only permissions, or
  new tasks when their eval artifacts are included.
- Major releases are required for removed tasks, changed required input/output
  fields, schema changes that alter existing fields, or renamed tasks.

## Review

Before publishing a package version, run the eval suite and compare it with the
previous release artifact:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary > candidate.json
node cli/forma/dist/index.js compare baseline.json candidate.json --fail-on breaking,environment
```

Archive the candidate artifact with the package manifest. Reviewers should look
at `contractChanges`, `settingChanges`, and the machine-readable `changes`
array before approving a version bump.

## Verification

The docs gate checks that `examples/review_diff.forma.pkg.json` has a package
format marker, semver version, matching task source hash, eval suite path,
current generated bindings, existing host examples, and compatibility policy.
The CLI exposes the same check for package users:

```bash
corepack pnpm docs:check
node cli/forma/dist/index.js package-check examples/review_diff.forma.pkg.json
```
