from typing import Any

ToolRepairOutput = dict[str, Any]


def plan_repair_followup(output: ToolRepairOutput) -> dict[str, object]:
    if bool(output["edited"]) and bool(output["test_passed"]):
        return {
            "action": "commit_repair",
            "requires_human_review": False,
            "summary": str(output["summary"]),
        }
    if bool(output["edited"]):
        return {
            "action": "rerun_tests",
            "requires_human_review": True,
            "summary": str(output["summary"]),
        }
    return {
        "action": "inspect_manually",
        "requires_human_review": True,
        "summary": str(output["summary"]),
    }
