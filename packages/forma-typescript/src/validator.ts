import type { FormaDiagnostic, FormaProgram, FormaSourceSpan } from "./types.js";

export function validateProgram(program: FormaProgram, sourceName: string): FormaDiagnostic[] {
  const diagnostics: FormaDiagnostic[] = [];
  const seen = new Set<string>();
  for (const task of program.tasks) {
    if (seen.has(task.name)) {
      diagnostics.push(diagnostic("F2003", `duplicate task name '${task.name}'`, sourceName, task.sourceSpan));
    }
    seen.add(task.name);
    if (Object.keys(task.output).length === 0) {
      diagnostics.push(diagnostic("F2001", "task requires at least one output field", sourceName, task.sourceSpan));
    }
    if (task.compute.length === 0 && !task.agentInstruction) {
      diagnostics.push(diagnostic("F2002", "task requires compute or agent behavior", sourceName, task.sourceSpan));
    }
  }
  return diagnostics;
}

function diagnostic(code: string, message: string, source: string, span?: FormaSourceSpan): FormaDiagnostic {
  return {
    severity: "error",
    code,
    message,
    source,
    start: span?.start ?? { line: 1, column: 1 },
    end: span?.end ?? { line: 1, column: 1 },
  };
}
