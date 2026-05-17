import type { FormaDiagnostic, FormaProgram } from "./types.js";

export function validateProgram(program: FormaProgram, sourceName: string): FormaDiagnostic[] {
  const diagnostics: FormaDiagnostic[] = [];
  for (const task of program.tasks) {
    if (Object.keys(task.output).length === 0) {
      diagnostics.push(diagnostic("F2001", "task requires at least one output field", sourceName));
    }
    if (task.compute.length === 0 && !task.agentInstruction) {
      diagnostics.push(diagnostic("F2002", "task requires compute or agent behavior", sourceName));
    }
  }
  return diagnostics;
}

function diagnostic(code: string, message: string, source: string): FormaDiagnostic {
  return {
    severity: "error",
    code,
    message,
    source,
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 },
  };
}
