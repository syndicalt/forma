from forma import FormaRuntime, StaticProvider


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

  verify {
    message.words <= 12
  }
}'''


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
