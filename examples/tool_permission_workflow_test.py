from tool_permission_plan import plan_repair_followup


def test_commits_repair_when_agent_edited_code_and_tests_passed() -> None:
    output = {
        "summary": "Read src/app.py, found 1 related matches, and ran pytest.",
        "searched": True,
        "test_passed": True,
        "edited": True,
    }

    assert plan_repair_followup(output) == {
        "action": "commit_repair",
        "requires_human_review": False,
        "summary": output["summary"],
    }


def test_reruns_tests_when_edits_happened_but_verification_failed() -> None:
    output = {
        "summary": "Edited src/app.py but the focused test failed.",
        "searched": True,
        "test_passed": False,
        "edited": True,
    }

    assert plan_repair_followup(output) == {
        "action": "rerun_tests",
        "requires_human_review": True,
        "summary": output["summary"],
    }


if __name__ == "__main__":
    test_commits_repair_when_agent_edited_code_and_tests_passed()
    test_reruns_tests_when_edits_happened_but_verification_failed()
