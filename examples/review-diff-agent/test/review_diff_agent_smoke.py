from forma import StaticProvider
from review_diff_agent import run_review_diff


output = run_review_diff(provider=StaticProvider({
    "summary": "Example summary.",
    "findings": [{
        "path": "example",
        "line": 1,
        "message": "Example message.",
    }],
    "clean": True,
}))

assert output is not None
print(output)
