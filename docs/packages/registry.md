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

Start a new package with the CLI when you want the task, evals, bindings,
manifest, lockfile, host examples, and package CI commands created together:

```bash
forma package-init ./review-diff-package --name acme/review-diff --task review_diff
forma package-init ./repair-package --name acme/tool-repair --task tool_assisted_repair --kind tool
forma package-check ./review-diff-package/review_diff.forma.pkg.json
forma package-lock ./review-diff-package/review_diff.forma.pkg.json \
  --output ./review-diff-package/review_diff.forma.lock.json \
  --check
```

Scaffolded packages include `forma.provider.json` so runtime configuration is a
reviewable file instead of hidden in host code. `forma package-init` can
customize that file with provider flags such as `--provider`, `--endpoint`,
`--model`, `--api-key-env`, `--response-format`, `--temperature`, and
`--timeout-ms`. The generated profile stays secret-free by recording the key
environment variable name with `apiKeyEnv`; hosts read the actual key from the
process environment. The package manifest records the profile path as
`providerProfile`. The same scaffold command can customize task fields with
`--input-field`, `--output-field`, and `--output-object`, so the manifest hash,
generated TypeScript/Python bindings, eval fixture, and lockfile all describe
the task-specific contract rather than a generic review template. The generated
host examples also use the task-specific input type, which keeps embedding code
aligned with the reviewed package contract.

The scaffolded `README.md` includes the package-check, package-lock, eval-suite,
and compare commands that should run before publishing or consuming a changed
package. The scaffolded `.github/workflows/forma-package.yml` runs the package
check, lock check, and eval-suite summary in GitHub Actions and uploads the
candidate eval artifact.

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
  "providerProfile": "forma.provider.json",
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
    "environment": ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"]
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

## Lockfile

Use `forma package-lock` to produce a reviewed artifact lock for a package
manifest. The lockfile schema lives at
`packages/forma-core/schema/package-lock.schema.json`. A lock pins the package
manifest hash, task source hashes, eval suite hash, provider profile hash,
generated binding hashes, and host example hashes. Provider secrets stay out of
the lock; the provider section records reviewable settings such as provider,
endpoint, model, `apiKeyEnv`, response format, temperature, and timeout.

```bash
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json \
  --check
```

The checked-in example lockfile is `examples/review_diff.forma.lock.json`.
Consumers can review the manifest for intent and compatibility policy, then use
the lockfile to verify the exact artifacts that were evaluated and published.

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

Publishing checklist:

- Run `forma package-check` against the manifest.
- Run `forma package-lock --check` against the checked-in lockfile.
- Run the package eval suite and archive the summary artifact.
- Compare the candidate summary against the previous release with
  `forma compare --fail-on breaking,environment`.
- Publish the manifest, lockfile, `.forma` sources, eval suite, provider
  profile, generated TypeScript/Python bindings, and host examples together.

## Verification

The docs gate checks that `examples/review_diff.forma.pkg.json` has a package
format marker, semver version, matching task source hash, eval suite path,
current generated bindings, existing host examples, and compatibility policy.
It also checks that `examples/review_diff.forma.lock.json` matches the locked
manifest and artifact hashes.
The CLI exposes the same check for package users:

```bash
corepack pnpm docs:check
node cli/forma/dist/index.js package-check examples/review_diff.forma.pkg.json
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json \
  --check
```
