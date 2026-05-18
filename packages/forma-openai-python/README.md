# forma-openai

OpenAI Responses provider package for the Forma Python runtime.

Install this package alongside `forma-lang` when host code should keep
production provider wiring separate from task contracts:

```python
import os

from forma import agent
from forma_openai import OpenAIResponsesProvider

review_diff = agent(
    "review_diff.forma",
    "review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
    ),
)
```

Forma task files still contain instructions, schemas, permissions, and
verification rules. The host program owns the API key, model selection, timeout,
logging, and deployment policy.
