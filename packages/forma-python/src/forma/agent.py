import hashlib
import json
from pathlib import Path
from typing import Any

from .provider import ModelProvider, provider_from_profile, provider_profile_from_file
from .runtime import FormaRuntime
from .types import FormaResult, FormaValue


class FormaAgent:
    def __init__(
        self,
        *,
        task: str,
        provider: ModelProvider | None = None,
        tools: dict[str, object] | None = None,
        source: str | None = None,
        source_name: str | None = None,
        file: str | Path | None = None,
    ) -> None:
        if (source is None) == (file is None):
            raise ValueError("agent requires exactly one of source or file")
        self.task = task
        self.source = source
        self.source_name = source_name or "inline.forma"
        self.file = file
        self.runtime = FormaRuntime(model_provider=provider, tools=tools)

    def run(self, input: dict[str, FormaValue]) -> FormaResult:
        if self.file is not None:
            return self.runtime.run_file(self.file, self.task, input=input)
        return self.runtime.run_task(
            self.source or "",
            self.task,
            input=input,
            source_name=self.source_name,
        )


def agent(
    *,
    task: str,
    provider: ModelProvider | None = None,
    tools: dict[str, object] | None = None,
    source: str | None = None,
    source_name: str | None = None,
    file: str | Path | None = None,
) -> FormaAgent:
    return FormaAgent(
        task=task,
        provider=provider,
        tools=tools,
        source=source,
        source_name=source_name,
        file=file,
    )


def agent_from_package_lock(
    *,
    lock_file: str | Path,
    task: str,
    provider: ModelProvider | None = None,
    tools: dict[str, object] | None = None,
) -> FormaAgent:
    lock_path = Path(lock_file)
    lock = json.loads(lock_path.read_text(encoding="utf8"))
    if lock.get("formaPackageLock") != 1:
        raise ValueError("package lock must have formaPackageLock: 1")

    locked_task = _locked_task(lock, task)
    source_path = lock_path.parent / locked_task["source"]
    source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
    if source_sha256 != locked_task["sourceSha256"]:
        raise ValueError(f"task source does not match reviewed package lock: {source_path}")
    _verify_package_lock_artifacts(lock, lock_path.parent)

    return agent(
        file=source_path,
        task=task,
        provider=provider or _provider_from_package_lock(lock, lock_path.parent),
        tools=tools,
    )


def _locked_task(lock: dict[str, Any], name: str) -> dict[str, str]:
    for task in lock.get("tasks", []):
        if task.get("name") == name and task.get("source") and task.get("sourceSha256"):
            return task
    raise ValueError(f"{name} is not pinned by the Forma package lock")


def _verify_package_lock_artifacts(lock: dict[str, Any], lock_dir: Path) -> None:
    provider_profile = lock.get("providerProfile")
    if isinstance(provider_profile, dict) and provider_profile.get("path") and provider_profile.get("sha256"):
        _verify_package_lock_hash(lock_dir / provider_profile["path"], provider_profile["sha256"], "provider profile")
    for binding in lock.get("bindings", []):
        if binding.get("output") and binding.get("sha256"):
            _verify_package_lock_hash(lock_dir / binding["output"], binding["sha256"], "generated binding")


def _verify_package_lock_hash(path: Path, expected_sha256: str, artifact_name: str) -> None:
    actual_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_sha256 != expected_sha256:
        raise ValueError(f"{artifact_name} does not match reviewed package lock: {path}")


def _provider_from_package_lock(lock: dict[str, Any], lock_dir: Path) -> ModelProvider:
    provider_profile = lock.get("providerProfile")
    if not isinstance(provider_profile, dict) or not provider_profile.get("path"):
        raise ValueError("package lock providerProfile.path is required when provider is not supplied")
    return provider_from_profile(provider_profile_from_file(lock_dir / provider_profile["path"]))
