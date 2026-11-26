/**
 * The typed request `parseViewArgs` produces from the arguments after `view`.
 *
 * - `run` — launch the observer; `port` is present only when `--port` was given. `kanbanPath` is the
 *   absolute kanban folder from `--kanban <path>` or `--brain <path>` (as `<path>/kanban`), present
 *   only when one was given; `deprecatedBrain` is set only when it came from `--brain`.
 * - `help` — `--help` was passed.
 * - `invalid` — the arguments were malformed; `message` names the offending argument.
 */
export type ViewArgs =
	| { kind: "run"; port?: number; kanbanPath?: string; deprecatedBrain?: true }
	| { kind: "help" }
	| { kind: "invalid"; message: string };
