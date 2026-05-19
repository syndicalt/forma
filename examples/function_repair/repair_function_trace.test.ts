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
    await writeFile(sourcePath, "export function calculateTotal(subtotal: number, discount: number): number {\n  return subtotal;\n}\n", "utf8");

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
