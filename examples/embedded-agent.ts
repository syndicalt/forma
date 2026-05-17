import { readFile } from "node:fs/promises";
import { FormaRuntime, type FormaValue, type ModelProvider } from "@forma-lang/forma";

class HostedModelProvider implements ModelProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async runAgent(input: {
    instruction: string;
    values: Record<string, unknown>;
  }): Promise<Record<string, FormaValue>> {
    const response = await callModelService({
      apiKey: this.apiKey,
      model: this.model,
      instruction: input.instruction,
      values: input.values,
    });

    return { message: response.message };
  }
}

const source = await readFile("examples/greet_user_warmly.forma", "utf8");
const runtime = new FormaRuntime({
  modelProvider: new HostedModelProvider(
    process.env.MODEL_API_KEY ?? "",
    process.env.MODEL_NAME ?? "example-model",
  ),
});

const result = await runtime.runTask(source, "greet_user_warmly", {
  input: { user_name: "Sam" },
  sourceName: "examples/greet_user_warmly.forma",
});

if (!result.ok) {
  throw new Error(result.error ?? "Forma task failed");
}

console.log(result.output);

async function callModelService(input: {
  apiKey: string;
  model: string;
  instruction: string;
  values: Record<string, unknown>;
}): Promise<{ message: string }> {
  if (!input.apiKey) {
    throw new Error("MODEL_API_KEY is required");
  }
  return {
    message: `Hello, ${String(input.values.user_name ?? "there")}. Good to see you.`,
  };
}
