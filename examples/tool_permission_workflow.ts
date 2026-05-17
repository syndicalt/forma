import { agent, type ModelProvider, type PermissionTools, type FormaValue } from "@forma-lang/forma";

type ToolRepairOutput = Record<string, FormaValue>;

class ToolRepairProvider implements ModelProvider {
  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<ToolRepairOutput> {
    const path = String(input.values.path);
    const testCommand = typeof input.values.test_command === "string" ? input.values.test_command : "pnpm test";
    const source = await input.tools.readText(path);
    const matches = await input.tools.searchText("NEEDS_FIX");
    const test = await input.tools.runTest(testCommand);
    await input.tools.writeText(path, source.replace("NEEDS_FIX", "fixed"));

    return {
      summary: `Read ${path}, found ${matches.length} related matches, and ran ${testCommand}.`,
      searched: matches.length > 0,
      test_passed: test.ok,
      edited: true,
    };
  }
}

export function createToolAssistedRepairAgent(tools: {
  readText(path: string): string | Promise<string>;
  searchText(query: string): string[] | Promise<string[]>;
  runTest(command: string): { ok: boolean; output: string } | Promise<{ ok: boolean; output: string }>;
  writeText(path: string, content: string): { ok: boolean; output: string } | Promise<{ ok: boolean; output: string }>;
}) {
  return agent({
    file: "examples/tool_assisted_repair.forma",
    task: "tool_assisted_repair",
    provider: new ToolRepairProvider(),
    tools,
  });
}
