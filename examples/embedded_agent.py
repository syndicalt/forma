import os
from pathlib import Path

from forma import FormaRuntime, ModelProvider, PermissionTools


def call_model_service(
    api_key: str,
    model: str,
    instruction: str,
    values: dict,
    permissions: list[str],
) -> dict:
    if not api_key:
        raise RuntimeError("MODEL_API_KEY is required")
    return {
        "message": f"Hello, {values.get('user_name', 'there')}. Good to see you.",
    }


class HostedModelProvider(ModelProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def run_agent(self, instruction: str, values: dict, permissions: list[str], tools: PermissionTools) -> dict:
        tools.require("read")
        response = call_model_service(
            api_key=self.api_key,
            model=self.model,
            instruction=instruction,
            values=values,
            permissions=permissions,
        )
        return {"message": response["message"]}


source_path = Path("examples/greet_user_warmly.forma")
runtime = FormaRuntime(
    model_provider=HostedModelProvider(
        api_key=os.environ["MODEL_API_KEY"],
        model=os.environ.get("MODEL_NAME", "example-model"),
    )
)

result = runtime.run_task(
    source_path.read_text(encoding="utf8"),
    "greet_user_warmly",
    input={"user_name": "Sam"},
    source_name=str(source_path),
)

if not result.ok:
    raise RuntimeError(result.error or "Forma task failed")

print(result.output)
