from forma import parse_forma


def test_records_source_spans_for_parsed_tasks():
    program = parse_forma('''
task first_task {
  intent "First"

  input {
    name: Text
  }

  output {
    message: Text
  }

  compute {
    message = "Hello"
  }
}

task second_task {
  intent "Second"

  input {
    name: Text
  }

  output {
    message: Text
  }

  compute {
    message = "Hello"
  }
}''')

    assert [task.source_span for task in program.tasks] == [
        {
            "start": {"line": 2, "column": 1},
            "end": {"line": 16, "column": 2},
        },
        {
            "start": {"line": 18, "column": 1},
            "end": {"line": 32, "column": 2},
        },
    ]
