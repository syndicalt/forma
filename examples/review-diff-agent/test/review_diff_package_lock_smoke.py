from pathlib import Path

from forma import StaticProvider, agent_from_package_lock


LOCK_FILE = Path(__file__).resolve().parents[2] / "review_diff.forma.lock.json"

review_diff = agent_from_package_lock(
    lock_file=LOCK_FILE,
    task="review_diff",
    provider=StaticProvider({
        "summary": "Reviewed through package lock.",
        "findings": [{
            "path": "src/example.py",
            "line": 7,
            "message": "Example package-lock finding.",
        }],
        "clean": False,
    }),
)

result = review_diff.run({
    "diff": "diff --git a/src/example.py b/src/example.py",
    "max_findings": 1,
})

assert result.ok
assert result.output == {
    "summary": "Reviewed through package lock.",
    "findings": [{
        "path": "src/example.py",
        "line": 7,
        "message": "Example package-lock finding.",
    }],
    "clean": False,
}

print(result.output)
