import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
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

async function createBundle({ sourceDir, files, bundlePath }) {
  await run("tar", [
    "-czf",
    bundlePath,
    "-C",
    sourceDir,
    ...files,
  ]);
}

async function installTypeScriptConsumer(packageDir, runtimeTarball) {
  const packageJsonPath = join(packageDir, "package.json");
  let packageJson = {
    private: true,
    type: "module",
  };
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@forma-lang/forma": `file:${runtimeTarball}`,
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@types/node": packageJson.devDependencies?.["@types/node"] ?? "^22.15.18",
    typescript: packageJson.devDependencies?.typescript ?? "^5.8.3",
    vitest: packageJson.devDependencies?.vitest ?? "^3.2.4",
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  await run("corepack", ["pnpm", "install", "--config.dangerously-allow-all-builds=true"], { cwd: packageDir });
}

async function installPythonConsumer(packageDir) {
  const python = process.env.PYTHON ?? "python";
  const venvDir = join(packageDir, ".venv");
  const venvPython = join(venvDir, "bin", "python");
  await run(python, ["-m", "venv", venvDir], { cwd: packageDir });
  await run(venvPython, ["-m", "pip", "install", resolve(repoRoot, "packages/forma-python")], { cwd: packageDir });
  return venvPython;
}

const installedPackageSmokes = [
  {
    packageKind: "review-diff package-lock consumer",
    packageDir: "review-diff-package",
    bundleName: "review_diff.forma-package.tgz",
    sourceDir: "examples",
    files: [
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
    ],
    typeScriptCommand: ["corepack", ["pnpm", "exec", "vitest", "run", "review_diff_contract.test.ts"]],
    pythonCommand: ["review_diff_contract_test.py"],
  },
  {
    packageKind: "function-repair tool package",
    packageDir: "function-repair-package",
    bundleName: "repair_function.forma-package.tgz",
    sourceDir: "examples/function_repair",
    files: [
      "repair_function.forma.pkg.json",
      "repair_function.forma.lock.json",
      "repair_function.forma",
      "forma.eval.json",
      "forma.provider.json",
      "repair_function.eval.json",
      "repair_function.forma.ts",
      "repair_function_forma.py",
      "repair_function_package.ts",
      "repair_function_package.py",
      "README.md",
      ".github/workflows/forma-package.yml",
      ".github/workflows/forma-publish.yml",
    ],
    prepare: prepareFunctionRepairSmoke,
    typeScriptCommand: ["corepack", ["pnpm", "exec", "vitest", "run", "repair_function_installed.test.ts"]],
    pythonCommand: ["repair_function_installed_smoke.py"],
  },
  {
    packageKind: "reviewed package-lock project consumer",
    packageDir: "review-diff-lock-project-package",
    bundleName: "review_diff.lock-project-package.tgz",
    sourceDir: "examples",
    files: [
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
    ],
    prepare: preparePackageLockProjectSmoke,
    typeScriptCommand: ["corepack", ["pnpm", "run", "smoke:lock:ts"]],
    pythonCommand: ["test/review_diff_package_lock_smoke.py"],
  },
];

async function prepareFunctionRepairSmoke(packageDir) {
  await writeFile(join(packageDir, "repair_function_installed.test.ts"), `import { expect, it } from "vitest";
import { agentFromPackageLock, type FormaValue, type ModelProvider, type PermissionTools } from "@forma-lang/forma";

class FunctionRepairProvider implements ModelProvider {
  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const path = String(input.values.path);
    const functionName = String(input.values.function_name);
    const desiredBehavior = String(input.values.desired_behavior);
    const testCommand = String(input.values.test_command);
    const source = await input.tools.readText(path);
    await input.tools.searchText(functionName);
    const repaired = source.replace("NEEDS_FIX", desiredBehavior);
    await input.tools.writeText(path, repaired);
    const test = await input.tools.runTest(testCommand);
    return {
      summary: \`Updated \${functionName} in \${path} and ran \${testCommand}.\`,
      function_name: functionName,
      test_passed: test.ok,
      edited: repaired !== source,
    };
  }
}

it("runs the installed function repair package through the reviewed lock", async () => {
  const files = new Map([["src/billing.ts", "export function calculateTotal() { return 'NEEDS_FIX'; }"]]);
  const agent = agentFromPackageLock({
    lockFile: "repair_function.forma.lock.json",
    task: "repair_function",
    provider: new FunctionRepairProvider(),
    tools: {
      readText: async (path) => files.get(path) ?? "",
      searchText: async (query) => [...files.entries()].filter(([, content]) => content.includes(query)).map(([path]) => path),
      writeText: async (path, content) => {
        files.set(path, content);
        return { ok: true, output: path };
      },
      runTest: async (command) => ({ ok: command === "pnpm test -- billing", output: "ok" }),
    },
  });

  const result = await agent.run({
    path: "src/billing.ts",
    function_name: "calculateTotal",
    desired_behavior: "return total - discount",
    test_command: "pnpm test -- billing",
  });

  expect(result.ok).toBe(true);
  expect(result.output.function_name).toBe("calculateTotal");
  expect(result.output.test_passed).toBe(true);
  expect(result.output.edited).toBe(true);
  expect(files.get("src/billing.ts")).toContain("return total - discount");
});
`, "utf8");

  await writeFile(join(packageDir, "repair_function_installed_smoke.py"), `from forma import agent_from_package_lock


class FunctionRepairProvider:
    def run_agent(self, instruction, values, permissions, tools, output=None, schemas=None):
        path = str(values["path"])
        function_name = str(values["function_name"])
        desired_behavior = str(values["desired_behavior"])
        test_command = str(values["test_command"])
        source = tools.read_text(path)
        tools.search_text(function_name)
        repaired = source.replace("NEEDS_FIX", desired_behavior)
        tools.write_text(path, repaired)
        test = tools.run_test(test_command)
        return {
            "summary": f"Updated {function_name} in {path} and ran {test_command}.",
            "function_name": function_name,
            "test_passed": bool(test.get("ok")),
            "edited": repaired != source,
        }


files = {"src/billing.py": "def calculate_total():\\n    return 'NEEDS_FIX'\\n"}

agent = agent_from_package_lock(
    lock_file="repair_function.forma.lock.json",
    task="repair_function",
    provider=FunctionRepairProvider(),
    tools={
        "read_text": lambda path: files.get(path, ""),
        "search_text": lambda query: [path for path, content in files.items() if query in content],
        "write_text": lambda path, content: (files.__setitem__(path, content) or {"ok": True, "output": path}),
        "run_test": lambda command: {"ok": command == "pytest tests/test_billing.py", "output": "ok"},
    },
)

result = agent.run({
    "path": "src/billing.py",
    "function_name": "calculate_total",
    "desired_behavior": "return total - discount",
    "test_command": "pytest tests/test_billing.py",
})

assert result.ok
assert result.output["function_name"] == "calculate_total"
assert result.output["test_passed"] is True
assert result.output["edited"] is True
assert "return total - discount" in files["src/billing.py"]
`, "utf8");
}

async function preparePackageLockProjectSmoke(packageDir) {
  const projectDir = join(packageDir, "review-diff-lock-project");
  await run("node", [
    resolve(repoRoot, "cli/forma/dist/index.js"),
    "project-init",
    projectDir,
    "--name",
    "review-diff-lock-project",
    "--task",
    "review_diff",
    "--package-lock",
    join(packageDir, "review_diff.forma.lock.json"),
  ]);
  return { consumerDir: projectDir };
}

async function smokeInstalledPackage({ smoke, workDir, runtimeTarball }) {
  process.stdout.write(`installed package smoke: ${smoke.packageKind}\n`);
  const packageDir = join(workDir, smoke.packageDir);
  const bundlePath = join(workDir, smoke.bundleName);
  await mkdir(packageDir, { recursive: true });
  await createBundle({
    sourceDir: smoke.sourceDir,
    bundlePath,
    files: smoke.files,
  });
  await run("tar", ["-xzf", bundlePath, "-C", packageDir]);

  let consumerDir = packageDir;
  if (smoke.prepare) {
    const prepared = await smoke.prepare(packageDir);
    if (prepared?.consumerDir) {
      consumerDir = prepared.consumerDir;
    }
  }

  const [typeScriptCommand, typeScriptArgs] = smoke.typeScriptCommand;
  await installTypeScriptConsumer(consumerDir, runtimeTarball);
  await run(typeScriptCommand, typeScriptArgs, { cwd: consumerDir });

  const venvPython = await installPythonConsumer(consumerDir);
  await run(venvPython, smoke.pythonCommand, {
    cwd: consumerDir,
    env: {
      ...process.env,
      PYTHONPATH: consumerDir,
    },
  });
  process.stdout.write(`installed package smoke ok: ${smoke.packageKind}\n`);
  return {
    packageKind: smoke.packageKind,
    bundleName: smoke.bundleName,
    packageDir: smoke.packageDir,
    consumerDir: relative(workDir, consumerDir),
    typeScriptCommand: [typeScriptCommand, ...typeScriptArgs].join(" "),
    pythonCommand: smoke.pythonCommand.join(" "),
    passed: true,
  };
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), "forma-installed-package-"));
  try {
    const tarballDir = join(workDir, "tarballs");
    await mkdir(tarballDir, { recursive: true });

    await run("corepack", ["pnpm", "--filter", "@forma-lang/forma", "build"]);
    await run("corepack", ["pnpm", "--filter", "@forma-lang/cli", "build"]);
    const runtimeTarball = await npmPackTypeScriptRuntime(tarballDir);

    const packages = [];
    for (const smoke of installedPackageSmokes) {
      packages.push(await smokeInstalledPackage({ smoke, workDir, runtimeTarball }));
    }

    const installedPackageSmokeSummary = {
      passed: true,
      total: packages.length,
      packages,
    };
    process.stdout.write(`${JSON.stringify({ installedPackageSmokeSummary })}\n`);
    process.stdout.write("installed package smoke ok\n");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
