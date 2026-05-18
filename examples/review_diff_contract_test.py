import os
import sys
from pathlib import Path

_LOCAL_FORMA = Path(__file__).resolve().parent.parent / "packages" / "forma-python" / "src"
if _LOCAL_FORMA.exists():
    sys.path.insert(0, str(_LOCAL_FORMA))

from forma import StaticProvider
from review_diff_contract import review_code_diff, review_diff_agent


provider_output = {
    "summary": "Reviewed with an explicit provider override.",
    "findings": [
        {
            "path": "src/example.py",
            "line": 1,
            "message": "Example finding.",
        }
    ],
    "clean": False,
}


def test_loads_reviewed_package_lock_agent():
    previous_key = os.environ.get("OPENAI_API_KEY")
    os.environ["OPENAI_API_KEY"] = previous_key or "test-key"
    try:
        assert hasattr(review_diff_agent(), "run")
    finally:
        if previous_key is None:
            os.environ.pop("OPENAI_API_KEY", None)
        else:
            os.environ["OPENAI_API_KEY"] = previous_key


def test_runs_reviewed_package_lock_agent_with_explicit_provider_override():
    output = review_code_diff(
        "diff --git a/src/example.py b/src/example.py",
        provider=StaticProvider(provider_output),
    )

    assert output.summary == provider_output["summary"]


if __name__ == "__main__":
    test_loads_reviewed_package_lock_agent()
    test_runs_reviewed_package_lock_agent_with_explicit_provider_override()
