import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "..");

async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024 * 20,
      ...options,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

async function npmPackTypeScriptRuntime(tarballDir) {
  const { stdout } = await execFileAsync("npm", [
    "pack",
    "./packages/forma-typescript",
    "--pack-destination",
    tarballDir,
  ], { cwd: repoRoot });
  return join(tarballDir, stdout.trim().split(/\r?\n/).at(-1));
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), "forma-installed-package-"));
  try {
    const tarballDir = join(workDir, "tarballs");
    const packageDir = join(workDir, "review-diff-package");
    const bundlePath = join(workDir, "review_diff.forma-package.tgz");
    await mkdir(tarballDir, { recursive: true });
    await mkdir(packageDir, { recursive: true });

    await run("corepack", ["pnpm", "--filter", "@forma-lang/forma", "build"]);
    const runtimeTarball = await npmPackTypeScriptRuntime(tarballDir);

    await run("tar", [
      "-czf",
      bundlePath,
      "-C",
      "examples",
      "review_diff.forma.pkg.json",
      "review_diff.forma.lock.json",
      "review_diff.forma",
      "forma.eval.json",
      "forma.provider.json",
      "review_diff.forma.ts",
      "review_diff_forma.py",
      "review_diff_package.ts",
      "review_diff_package.py",
      "tool_permission_workflow.ts",
      "tool_permission_workflow.py",
      "tool_permission_plan.ts",
      "tool_permission_plan.py",
      "review_diff_lock_consumer.ts",
      "review_diff_lock_consumer.py",
      "review_diff_decision.ts",
      "review_diff_decision.py",
      "review_diff_inline.ts",
      "review_diff_inline.py",
      "review_diff_contract",
      "review_diff_decision.test.ts",
      "review_diff_decision_test.py",
      "tool_permission_workflow.test.ts",
      "tool_permission_workflow_test.py",
      "review_diff_contract.test.ts",
      "review_diff_contract_test.py",
      "review_diff_migration.test.ts",
      "review_diff_migration_test.py",
      "README.md",
      ".github/workflows/forma-package.yml",
      ".github/workflows/forma-publish.yml",
    ]);
    await run("tar", ["-xzf", bundlePath, "-C", packageDir]);

    await writeFile(join(packageDir, "package.json"), `${JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@forma-lang/forma": `file:${runtimeTarball}`,
      },
      devDependencies: {
        "@types/node": "^22.15.18",
        typescript: "^5.8.3",
        vitest: "^3.2.4",
      },
    }, null, 2)}\n`, "utf8");

    await run("corepack", ["pnpm", "install", "--config.dangerously-allow-all-builds=true"], { cwd: packageDir });
    await run("corepack", ["pnpm", "exec", "vitest", "run", "review_diff_contract.test.ts"], { cwd: packageDir });

    const python = process.env.PYTHON ?? "python";
    const venvDir = join(packageDir, ".venv");
    const venvPython = join(venvDir, "bin", "python");
    await run(python, ["-m", "venv", venvDir], { cwd: packageDir });
    await run(venvPython, ["-m", "pip", "install", resolve(repoRoot, "packages/forma-python")], { cwd: packageDir });
    await run(venvPython, ["review_diff_contract_test.py"], {
      cwd: packageDir,
      env: {
        ...process.env,
        PYTHONPATH: packageDir,
      },
    });

    process.stdout.write("installed package smoke ok\n");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
