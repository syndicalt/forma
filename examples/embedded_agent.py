import json
import os
from pathlib import Path

from forma import OpenAIResponsesProvider, agent


source_path = Path("examples/review_diff.forma")
diff = os.environ.get(
    "FORMA_DIFF",
    """diff --git a/src/review.py b/src/review.py
@@
-return len(findings) == 0
+return all(finding["severity"] != "error" for finding in findings)""",
)

review_diff = agent(
    file=source_path,
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    ),
)

result = review_diff.run({"diff": diff, "max_findings": 5})

if not result.ok:
    raise RuntimeError(result.error or "Forma task failed")

print(json.dumps(result.output, indent=2))
