import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), "forma-installed-project-"));
  try {
    const projectDir = join(workDir, "review-diff-installed");
    const tarballDir = join(workDir, "tarballs");
    await mkdir(tarballDir, { recursive: true });

    await run("corepack", ["pnpm", "--filter", "@forma-lang/forma", "build"]);
    await run("corepack", ["pnpm", "--filter", "@forma-lang/cli", "build"]);
    const { stdout: packed } = await execFileAsync("npm", [
      "pack",
      "./packages/forma-typescript",
      "--pack-destination",
      tarballDir,
    ], { cwd: repoRoot });
    const tarball = join(tarballDir, packed.trim().split(/\r?\n/).at(-1));

    await run("node", [
      "cli/forma/dist/index.js",
      "project-init",
      projectDir,
      "--name",
      "review-diff-installed",
      "--task",
      "review_diff",
    ]);

    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    packageJson.dependencies["@forma-lang/forma"] = `file:${tarball}`;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    await run("corepack", ["pnpm", "install", "--config.dangerously-allow-all-builds=true"], { cwd: projectDir });
    await run("corepack", ["pnpm", "run", "check"], { cwd: projectDir });
    await run("corepack", ["pnpm", "run", "smoke:ts"], { cwd: projectDir });

    const python = process.env.PYTHON ?? "python";
    const venvDir = join(projectDir, ".venv");
    const venvPython = join(venvDir, "bin", "python");
    await run(python, ["-m", "venv", venvDir], { cwd: projectDir });
    await run(venvPython, ["-m", "pip", "install", resolve(repoRoot, "packages/forma-python")], { cwd: projectDir });
    await run(venvPython, ["test/review_diff_agent_smoke.py"], {
      cwd: projectDir,
      env: {
        ...process.env,
        PYTHONPATH: join(projectDir, "src"),
      },
    });

    process.stdout.write("installed project smoke ok\n");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
