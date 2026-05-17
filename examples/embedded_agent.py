import json
import os
from pathlib import Path

from forma import FormaRuntime, OpenAIResponsesProvider


source_path = Path("examples/review_diff.forma")
diff = os.environ.get(
    "FORMA_DIFF",
    """diff --git a/src/review.py b/src/review.py
@@
-return len(findings) == 0
+return all(finding["severity"] != "error" for finding in findings)""",
)

runtime = FormaRuntime(
    model_provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    )
)

result = runtime.run_file(
    source_path,
    "review_diff",
    input={"diff": diff, "max_findings": 5},
)

if not result.ok:
    raise RuntimeError(result.error or "Forma task failed")

print(json.dumps(result.output, indent=2))
