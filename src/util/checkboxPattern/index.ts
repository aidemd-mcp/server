/**
 * The one shared markdown list-checkbox pattern: optional indentation, a `-`, `*`, `+`, `1.` or
 * `1)` marker, then `[ ]` or `[x]`. Group 1 is the box character (a space when open) and group 2
 * is the rest of the line after the closing bracket. The status counter (`countCheckboxes`) and
 * the page's plan and todo parsers all read checkbox lines through it, so they can never disagree
 * about what a checkbox is. Not global, so `exec` and `match` carry no state between lines.
 */
const CHECKBOX_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\](.*)$/;

export default CHECKBOX_PATTERN;
