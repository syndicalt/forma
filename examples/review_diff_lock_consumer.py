from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from forma import agent, provider_from_profile, provider_profile_from_file
from review_diff_forma import ReviewDiffOutput, assert_review_diff_output


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reviewed_review_diff_agent(lock_path: Path = Path("examples/review_diff.forma.lock.json")):
    lock = json.loads(lock_path.read_text(encoding="utf8"))
    task = _find_task(lock, "review_diff")
    source_path = lock_path.parent / task["source"]
    if _sha256(source_path) != task["sourceSha256"]:
        raise RuntimeError(f"review_diff source does not match reviewed lock: {source_path}")

    provider_profile = provider_profile_from_file(lock_path.parent / lock["providerProfile"]["path"])
    return agent(
        file=source_path,
        task=task["name"],
        provider=provider_from_profile(provider_profile),
    )


def review_code_diff_from_reviewed_lock(diff: str) -> ReviewDiffOutput:
    result = reviewed_review_diff_agent().run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)


def _find_task(lock: dict[str, Any], name: str) -> dict[str, Any]:
    for task in lock["tasks"]:
        if task["name"] == name:
            return task
    raise RuntimeError(f"{name} is not pinned by the Forma package lock")
