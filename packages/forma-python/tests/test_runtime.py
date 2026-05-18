import hashlib
import json
from pathlib import Path

from forma import FormaRuntime, StaticProvider, agent, agent_from_package_lock


DETERMINISTIC_SOURCE = '''task greet_user {
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
}'''


AGENT_SOURCE = '''task greet_user_warmly {
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

  permissions {
    read
    search
    test
  }

  verify {
    message.words <= 12
  }
}'''


MULTI_TASK_SOURCE = f"{DETERMINISTIC_SOURCE}\n\n{AGENT_SOURCE}"


METRICS_SOURCE = '''task summarize_metrics {
  intent "Summarize review metrics"

  input {
    diff: Text
  }

  output {
    summary: Text
    finding_count: Number
    clean: Boolean
  }

  agent {
    instruction """
    Return review metrics.
    """
  }
}'''


REVIEW_FINDINGS_SOURCE = '''task review_diff {
  intent "Review a code diff"

  input {
    diff: Text
  }

  output {
    summary: Text
    findings: Finding[]
    clean: Boolean

    object Finding {
      path: Text
      line: Number?
      message: Text
    }
  }

  agent {
    instruction """
    Return structured review findings.
    """
  }
}'''


EDIT_SOURCE = '''task update_file {
  intent "Update a source file"

  input {
    path: Text
  }

  output {
    message: Text
  }

  agent {
    instruction """
    Update the requested file.
    """
  }

  permissions {
    edit
  }
}'''


def test_embeds_reviewed_package_lock_task_through_agent_facade(tmp_path: Path):
    source_path = tmp_path / "task.forma"
    profile_path = tmp_path / "forma.provider.json"
    lock_path = tmp_path / "task.forma.lock.json"
    source_path.write_text(AGENT_SOURCE, encoding="utf8")
    profile_path.write_text(
        json.dumps({"provider": "http-json", "endpoint": "https://example.test/agent", "model": "test-model"}),
        encoding="utf8",
    )
    lock_path.write_text(
        json.dumps(
            {
                "formaPackageLock": 1,
                "tasks": [
                    {
                        "name": "greet_user_warmly",
                        "source": "task.forma",
                        "sourceSha256": hashlib.sha256(AGENT_SOURCE.encode("utf8")).hexdigest(),
                    }
                ],
                "providerProfile": {"path": "forma.provider.json"},
            }
        ),
        encoding="utf8",
    )

    greet = agent_from_package_lock(
        lock_file=lock_path,
        task="greet_user_warmly",
        provider=StaticProvider({"message": "Hello from a reviewed lock."}),
    )

    result = greet.run({"user_name": "Sam"})

    assert result.ok is True
    assert result.output == {"message": "Hello from a reviewed lock."}


def test_rejects_package_lock_agents_when_pinned_task_source_drifts(tmp_path: Path):
    source_path = tmp_path / "task.forma"
    lock_path = tmp_path / "task.forma.lock.json"
    source_path.write_text(AGENT_SOURCE, encoding="utf8")
    lock_path.write_text(
        json.dumps(
            {
                "formaPackageLock": 1,
                "tasks": [
                    {
                        "name": "greet_user_warmly",
                        "source": "task.forma",
                        "sourceSha256": "0" * 64,
                    }
                ],
            }
        ),
        encoding="utf8",
    )

    try:
        agent_from_package_lock(
            lock_file=lock_path,
            task="greet_user_warmly",
            provider=StaticProvider({"message": "unused"}),
        )
    except ValueError as error:
        assert "task source does not match reviewed package lock" in str(error)
    else:
        raise AssertionError("expected lock drift to fail")


def test_embeds_named_source_task_through_agent_facade():
    greet = agent(
        source=AGENT_SOURCE,
        source_name="agent.forma",
        task="greet_user_warmly",
        provider=StaticProvider({"message": "Hello, Sam. Good to see you."}),
    )

    result = greet.run({"user_name": "Sam"})

    assert result.ok is True
    assert result.output == {"message": "Hello, Sam. Good to see you."}


def test_embeds_named_file_task_through_agent_facade(tmp_path: Path):
    source_path = tmp_path / "task.forma"
    source_path.write_text(AGENT_SOURCE, encoding="utf8")

    greet = agent(
        file=source_path,
        task="greet_user_warmly",
        provider=StaticProvider({"message": "Hello, Sam. Good to see you."}),
    )

    result = greet.run({"user_name": "Sam"})

    assert result.ok is True
    assert result.output == {"message": "Hello, Sam. Good to see you."}


def test_executes_deterministic_compute_and_verify():
    runtime = FormaRuntime()
    result = runtime.run_source(
        DETERMINISTIC_SOURCE,
        input={"user_name": "Sam"},
        source_name="inline.forma",
    )

    assert result.ok is True
    assert result.output == {"message": "Hello, Sam!"}
    assert result.verification["ok"] is True
    assert result.diagnostics == []


def test_executes_named_task_from_forma_file(tmp_path: Path):
    source_path = tmp_path / "task.forma"
    source_path.write_text(DETERMINISTIC_SOURCE, encoding="utf8")

    result = FormaRuntime().run_file(
        source_path,
        "greet_user",
        input={"user_name": "Sam"},
    )

    assert result.ok is True
    assert result.output == {"message": "Hello, Sam!"}


def test_executes_agent_blocks_through_explicit_fake_provider():
    runtime = FormaRuntime(
        model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
    )
    result = runtime.run_source(
        AGENT_SOURCE,
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert result.output["message"] == "Hello, Sam. Good to see you."


def test_passes_declared_permissions_into_provider_calls():
    calls = []

    class CapturingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            calls.append({"permissions": permissions})
            return {"message": "Hello, Sam. Good to see you."}

    runtime = FormaRuntime(model_provider=CapturingProvider())
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert calls == [{"permissions": ["read", "search", "test"]}]


def test_traces_allowed_provider_permission_checks():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.require("read")
            return {"message": "Hello, Sam. Good to see you."}

    runtime = FormaRuntime(model_provider=ToolUsingProvider())
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert {"step": "permission", "detail": "read"} in result.trace


def test_fails_when_provider_requests_undeclared_permission():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.require("write")
            return {"message": "Hello, Sam. Good to see you."}

    runtime = FormaRuntime(model_provider=ToolUsingProvider())
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is False
    assert result.error == "F4001: permission 'write' is not declared"
    assert {"step": "permission_denied", "detail": "write"} in result.trace


def test_maps_provider_read_tool_calls_to_host_read_text_hooks():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            content = tools.read_text("README.md")
            return {"message": content}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"read_text": lambda path: "Forma contracts"},
    )
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert result.output == {"message": "Forma contracts"}
    assert {"step": "tool", "detail": "read:README.md"} in result.trace


def test_denies_read_tool_calls_when_read_permission_is_undeclared():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.read_text("README.md")
            return {"summary": "No issues", "finding_count": 0, "clean": True}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"read_text": lambda path: (_ for _ in ()).throw(RuntimeError("host read should not run"))},
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F4001: permission 'read' is not declared"
    assert {"step": "permission_denied", "detail": "read"} in result.trace


def test_traces_failed_host_read_tool_decisions():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.read_text("../secret.txt")
            return {"message": "unreachable"}

    def deny_read(path):
        raise RuntimeError(f"path is outside workspace: {path}")

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"read_text": deny_read},
    )
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is False
    assert result.error == "path is outside workspace: ../secret.txt"
    assert {"step": "tool_failed", "detail": "read:../secret.txt"} in result.trace


def test_maps_provider_search_tool_calls_to_host_search_text_hooks():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            matches = tools.search_text("FormaRuntime")
            return {"message": matches[0] if matches else "none"}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"search_text": lambda query: ["packages/forma-python/src/forma/runtime.py"]},
    )
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert result.output == {"message": "packages/forma-python/src/forma/runtime.py"}
    assert {"step": "tool", "detail": "search:FormaRuntime"} in result.trace


def test_denies_search_tool_calls_when_search_permission_is_undeclared():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.search_text("FormaRuntime")
            return {"summary": "No issues", "finding_count": 0, "clean": True}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"search_text": lambda query: (_ for _ in ()).throw(RuntimeError("host search should not run"))},
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F4001: permission 'search' is not declared"
    assert {"step": "permission_denied", "detail": "search"} in result.trace


def test_maps_provider_test_tool_calls_to_host_run_test_hooks():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            result = tools.run_test("pytest")
            return {"message": result["output"]}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"run_test": lambda command: {"ok": True, "output": "tests passed"}},
    )
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is True
    assert result.output == {"message": "tests passed"}
    assert {"step": "tool", "detail": "test:pytest"} in result.trace


def test_denies_test_tool_calls_when_test_permission_is_undeclared():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.run_test("pytest")
            return {"summary": "No issues", "finding_count": 0, "clean": True}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"run_test": lambda command: (_ for _ in ()).throw(RuntimeError("host test should not run"))},
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F4001: permission 'test' is not declared"
    assert {"step": "permission_denied", "detail": "test"} in result.trace


def test_maps_provider_edit_tool_calls_to_host_write_text_hooks():
    writes = []

    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            result = tools.write_text("src/file.py", "OK = True")
            return {"message": result["output"]}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={
            "write_text": lambda path, content: writes.append({"path": path, "content": content})
            or {"ok": True, "output": "updated"}
        },
    )
    result = runtime.run_task(
        EDIT_SOURCE,
        "update_file",
        input={"path": "src/file.py"},
        source_name="edit.forma",
    )

    assert result.ok is True
    assert writes == [{"path": "src/file.py", "content": "OK = True"}]
    assert result.output == {"message": "updated"}
    assert {"step": "tool", "detail": "edit:src/file.py"} in result.trace


def test_denies_edit_tool_calls_when_edit_permission_is_undeclared():
    class ToolUsingProvider:
        def run_agent(self, instruction, values, permissions, tools):
            tools.write_text("src/file.py", "OK = True")
            return {"summary": "No issues", "finding_count": 0, "clean": True}

    runtime = FormaRuntime(
        model_provider=ToolUsingProvider(),
        tools={"write_text": lambda path, content: (_ for _ in ()).throw(RuntimeError("host edit should not run"))},
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F4001: permission 'edit' is not declared"
    assert {"step": "permission_denied", "detail": "edit"} in result.trace


def test_executes_named_task_from_multi_task_source():
    runtime = FormaRuntime(
        model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
    )
    result = runtime.run_task(
        MULTI_TASK_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="multi.forma",
    )

    assert result.ok is True
    assert result.trace == [{"step": "agent", "detail": "greet_user_warmly"}]
    assert result.output == {"message": "Hello, Sam. Good to see you."}


def test_fails_validation_for_duplicate_task_names():
    runtime = FormaRuntime()
    result = runtime.run_task(
        f"{DETERMINISTIC_SOURCE}\n\n{DETERMINISTIC_SOURCE}",
        "greet_user",
        input={"user_name": "Sam"},
        source_name="duplicate.forma",
    )

    assert result.ok is False
    assert result.error == "validation failed"
    assert result.diagnostics[0]["code"] == "F2003"
    assert result.diagnostics[0]["message"] == "duplicate task name 'greet_user'"
    assert result.diagnostics[0]["start"] == {"line": 23, "column": 1}
    assert result.diagnostics[0]["end"] == {"line": 43, "column": 2}


def test_fails_when_provider_output_does_not_satisfy_task_output_contract():
    runtime = FormaRuntime(model_provider=StaticProvider({}))
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is False
    assert result.error == "F3003: output field 'message' is required"
    assert result.output == {}
    assert result.trace == [{"step": "agent", "detail": "greet_user_warmly"}]


def test_fails_when_provider_output_uses_wrong_mvp_output_type():
    runtime = FormaRuntime(model_provider=StaticProvider({"message": 42}))
    result = runtime.run_task(
        AGENT_SOURCE,
        "greet_user_warmly",
        input={"user_name": "Sam"},
        source_name="agent.forma",
    )

    assert result.ok is False
    assert result.error == "F3004: output field 'message' must be Text"


def test_validates_number_and_boolean_provider_output_fields():
    runtime = FormaRuntime(
        model_provider=StaticProvider(
            {
                "summary": "No issues found.",
                "finding_count": "0",
                "clean": "true",
            }
        )
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F3004: output field 'finding_count' must be Number"


def test_rejects_boolean_values_for_number_output_fields():
    runtime = FormaRuntime(
        model_provider=StaticProvider(
            {
                "summary": "No issues found.",
                "finding_count": True,
                "clean": True,
            }
        )
    )
    result = runtime.run_task(
        METRICS_SOURCE,
        "summarize_metrics",
        input={"diff": "diff --git a/file.py b/file.py"},
        source_name="metrics.forma",
    )

    assert result.ok is False
    assert result.error == "F3004: output field 'finding_count' must be Number"


def test_validates_arrays_of_structured_output_objects():
    runtime = FormaRuntime(
        model_provider=StaticProvider(
            {
                "summary": "One issue found.",
                "findings": [
                    {
                        "path": "src/review.py",
                        "line": 42,
                        "message": "Handle the empty diff case.",
                    }
                ],
                "clean": False,
            }
        )
    )
    result = runtime.run_task(
        REVIEW_FINDINGS_SOURCE,
        "review_diff",
        input={"diff": "diff --git a/src/review.py b/src/review.py"},
        source_name="review.forma",
    )

    assert result.ok is True
    assert result.output == {
        "summary": "One issue found.",
        "findings": [
            {
                "path": "src/review.py",
                "line": 42,
                "message": "Handle the empty diff case.",
            }
        ],
        "clean": False,
    }


def test_fails_when_structured_output_object_fields_use_the_wrong_type():
    runtime = FormaRuntime(
        model_provider=StaticProvider(
            {
                "summary": "One issue found.",
                "findings": [
                    {
                        "path": "src/review.py",
                        "line": "42",
                        "message": "Handle the empty diff case.",
                    }
                ],
                "clean": False,
            }
        )
    )
    result = runtime.run_task(
        REVIEW_FINDINGS_SOURCE,
        "review_diff",
        input={"diff": "diff --git a/src/review.py b/src/review.py"},
        source_name="review.forma",
    )

    assert result.ok is False
    assert result.error == "F3004: output field 'findings[0].line' must be Number"
