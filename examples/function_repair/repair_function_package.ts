import { agent, type FormaValue, type ModelProvider, type PermissionTools } from "@forma-lang/forma";
import { assertRepairFunctionOutput, type RepairFunctionOutput } from "./repair_function.forma.js";

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
    const repaired = source.includes("NEEDS_FIX")
      ? source.replace("NEEDS_FIX", desiredBehavior)
      : source;
    await input.tools.writeText(path, repaired);
    const test = await input.tools.runTest(testCommand);
    return {
      summary: `Updated ${functionName} in ${path} and ran ${testCommand}.`,
      function_name: functionName,
      test_passed: test.ok,
      edited: repaired !== source,
    };
  }
}

const repairFunction = agent({
  file: "repair_function.forma",
  task: "repair_function",
  provider: new FunctionRepairProvider(),
});

export async function runRepairFunction(): Promise<RepairFunctionOutput> {
  const result = await repairFunction.run({
    path: "src/billing.ts",
    function_name: "calculateTotal",
    desired_behavior: "Return the total including discounts.",
    test_command: "pnpm test -- billing",
  });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma repair_function failed");
  }
  return assertRepairFunctionOutput(result.output);
}
