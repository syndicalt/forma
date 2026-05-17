# Forma

Forma is a language for typed, permissioned, verifiable agent tasks embedded in Python and TypeScript programs.

The project ships a real `.forma` language package:

- Tree-sitter syntax grammar
- shared conformance fixtures
- Python runtime package
- TypeScript runtime package
- TypeScript CLI
- complete documentation for shipped behavior

## Engineering Rules

- Keep implementations simple, direct, readable, and inspectable.
- No fixture-only parser or runtime behavior.
- No fake CLI success paths.
- No undocumented fallback behavior.
- Documentation is part of every shipped feature.
