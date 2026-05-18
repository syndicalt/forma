import { describe, expect, it } from "vitest";
import { parseForma } from "../src/index.js";

describe("parseForma", () => {
  it("records source spans for parsed tasks", () => {
    const program = parseForma(`
task first_task {
  intent "First"

  input {
    name: Text
  }

  output {
    message: Text
  }

  compute {
    message = "Hello"
  }
}

task second_task {
  intent "Second"

  input {
    name: Text
  }

  output {
    message: Text
  }

  compute {
    message = "Hello"
  }
}`);

    expect(program.tasks.map((task) => task.sourceSpan)).toEqual([
      {
        start: { line: 2, column: 1 },
        end: { line: 16, column: 2 },
      },
      {
        start: { line: 18, column: 1 },
        end: { line: 32, column: 2 },
      },
    ]);
  });
});
