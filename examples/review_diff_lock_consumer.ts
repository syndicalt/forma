import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { agent, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "./review_diff.forma.js";

interface ReviewDiffLock {
  tasks: Array<{
    name: string;
    source: string;
    sourceSha256: string;
  }>;
  providerProfile: {
    path: string;
  };
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function reviewedReviewDiffAgent(lockPath = "examples/review_diff.forma.lock.json") {
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as ReviewDiffLock;
  const lockDir = dirname(lockPath);
  const task = lock.tasks.find((candidate) => candidate.name === "review_diff");
  if (!task) {
    throw new Error("review_diff is not pinned by the Forma package lock");
  }

  const sourcePath = join(lockDir, task.source);
  if (sha256(sourcePath) !== task.sourceSha256) {
    throw new Error(`review_diff source does not match reviewed lock: ${sourcePath}`);
  }

  return agent({
    file: sourcePath,
    task: task.name,
    provider: providerFromProfile(providerProfileFromFile(join(lockDir, lock.providerProfile.path))),
  });
}

export async function reviewCodeDiffFromReviewedLock(diff: string): Promise<ReviewDiffOutput> {
  const result = await reviewedReviewDiffAgent().run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}
