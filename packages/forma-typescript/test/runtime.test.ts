import { describe, expect, it } from "vitest";
import { FormaRuntime, StaticProvider } from "../src/index.js";

const deterministicSource = `task greet_user {
  intent "Greet the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  compute {
    message = if user_name
      then "Hello, {user_name}!"
      else "Hello, world!"
  }

  verify {
    message.length > 0
  }
}`;

const agentSource = `task greet_user_warmly {
  intent "Write a short friendly greeting for the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  agent {
    instruction """
    Write one concise greeting.
    Use the user's name if present.
    Do not ask a follow-up question.
    """
  }

  verify {
    message.words <= 12
  }
}`;

const multiTaskSource = `${deterministicSource}

${agentSource}`;

describe("FormaRuntime", () => {
  it("executes deterministic compute and verify", async () => {
    const runtime = new FormaRuntime();
    const result = await runtime.runSource(deterministicSource, {
      input: { user_name: "Sam" },
      sourceName: "inline.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Hello, Sam!" });
    expect(result.verification.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("executes agent blocks through an explicit fake provider", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await runtime.runSource(agentSource, {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output.message).toBe("Hello, Sam. Good to see you.");
  });

  it("executes a named task from a multi-task source", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await runtime.runTask(multiTaskSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "multi.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.trace).toEqual([{ step: "agent", detail: "greet_user_warmly" }]);
    expect(result.output).toEqual({ message: "Hello, Sam. Good to see you." });
  });

  it("fails when provider output does not satisfy the task output contract", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({}),
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3003: output field 'message' is required");
    expect(result.output).toEqual({});
    expect(result.trace).toEqual([{ step: "agent", detail: "greet_user_warmly" }]);
  });

  it("fails when provider output uses the wrong MVP output type", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: 42 }),
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3004: output field 'message' must be Text");
  });
});
