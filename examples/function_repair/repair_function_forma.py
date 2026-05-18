from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RepairFunctionInput:
    path: str
    function_name: str
    desired_behavior: str
    test_command: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RepairFunctionInput":
        return cls(
            path=data["path"],
            function_name=data["function_name"],
            desired_behavior=data["desired_behavior"],
            test_command=data["test_command"],
        )


@dataclass(frozen=True)
class RepairFunctionOutput:
    summary: str
    function_name: str
    test_passed: bool
    edited: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RepairFunctionOutput":
        return cls(
            summary=data["summary"],
            function_name=data["function_name"],
            test_passed=data["test_passed"],
            edited=data["edited"],
        )


def assert_repair_function_output(value: Any) -> RepairFunctionOutput:
    data = _assert_repair_function_record(value, "RepairFunctionOutput")
    if "summary" not in data:
        raise ValueError(f'RepairFunctionOutput.summary is required')
    _assert_repair_function_string(data["summary"], "RepairFunctionOutput.summary")
    if "function_name" not in data:
        raise ValueError(f'RepairFunctionOutput.function_name is required')
    _assert_repair_function_string(data["function_name"], "RepairFunctionOutput.function_name")
    if "test_passed" not in data:
        raise ValueError(f'RepairFunctionOutput.test_passed is required')
    _assert_repair_function_boolean(data["test_passed"], "RepairFunctionOutput.test_passed")
    if "edited" not in data:
        raise ValueError(f'RepairFunctionOutput.edited is required')
    _assert_repair_function_boolean(data["edited"], "RepairFunctionOutput.edited")
    return RepairFunctionOutput.from_dict(data)


def _assert_repair_function_record(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} must be an object")
    return value


def _assert_repair_function_string(value: Any, path: str) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{path} must be a string")


def _assert_repair_function_number(value: Any, path: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{path} must be a number")


def _assert_repair_function_boolean(value: Any, path: str) -> None:
    if not isinstance(value, bool):
        raise ValueError(f"{path} must be a boolean")
