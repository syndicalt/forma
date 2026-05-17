export default grammar({
  name: "forma",

  extras: ($) => [/\s/, $.comment],

  rules: {
    source_file: ($) => repeat($.task_declaration),

    task_declaration: ($) =>
      seq("task", field("name", $.identifier), "{", repeat($._task_member), "}"),

    _task_member: ($) =>
      choice(
        $.intent_block,
        $.input_block,
        $.output_block,
        $.compute_block,
        $.agent_block,
        $.permissions_block,
        $.constraints_block,
        $.verify_block,
      ),

    intent_block: ($) => seq("intent", $._string),
    input_block: ($) => seq("input", $._field_block),
    output_block: ($) => seq("output", $._field_block),
    compute_block: ($) => seq("compute", $._raw_block),
    agent_block: ($) => seq("agent", $._raw_block),
    permissions_block: ($) => seq("permissions", $._raw_block),
    constraints_block: ($) => seq("constraints", $._raw_block),
    verify_block: ($) => seq("verify", $._raw_block),

    _field_block: ($) => seq("{", repeat($._field_declaration), "}"),
    _field_declaration: ($) =>
      seq(field("name", $._field_identifier), ":", field("type", $._type_reference)),
    _type_reference: ($) => seq($._field_identifier, optional("?")),

    _raw_block: ($) => seq("{", repeat(choice($._triple_string, /[^{}"]+/, $._string)), "}"),
    _string: () => token(seq('"', repeat(choice(/[^"\\]/, /\\./)), '"')),
    _triple_string: () => token(seq('"""', repeat(choice(/[^"]/, /"[^"]/, /""[^"]/)), '"""')),
    comment: () => token(seq("//", /.*/)),
    _field_identifier: () => /[A-Za-z_][A-Za-z0-9_]*/,
    identifier: () => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});
