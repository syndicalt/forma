import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertRepairFunctionOutput } from "./repair_function.forma.js";
import { repairFunctionAgent } from "./repair_function_package.js";

describe("repair_function provider override contract", () => {
  it("accepts explicit host tools and validates generated output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-repair-contract-ts-"));
    const sourcePath = join(dir, "billing.ts");
    await writeFile(sourcePath, "export function calculateTotal(subtotal: number, discount: number): number {\n  return subtotal;\n}\n", "utf8");

    const agent = repairFunctionAgent({
      readText: async (path) => readFile(path, "utf8"),
      searchText: async () => [sourcePath],
      writeText: async (path, content) => {
        await writeFile(path, content, "utf8");
        return { ok: true, output: path };
      },
      runTest: async () => ({ ok: true, output: "ok" }),
    });

    const result = await agent.run({
      path: sourcePath,
      function_name: "calculateTotal",
      desired_behavior: "Return subtotal minus discount.",
      test_command: "pnpm test -- billing",
    });

    expect(result.ok).toBe(true);
    const output = assertRepairFunctionOutput(result.output);
    expect(output.function_name).toBe("calculateTotal");
    expect(output.test_passed).toBe(true);
    expect(output.edited).toBe(true);
  });
});
