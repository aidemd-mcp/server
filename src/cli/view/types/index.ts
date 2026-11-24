/**
 * The typed request `parseViewArgs` produces from the arguments after `view`.
 *
 * - `run` — launch the observer; `port` and `brainPath` are present only when their flag was given.
 * - `help` — `--help` was passed.
 * - `invalid` — the arguments were malformed; `message` names the offending argument.
 */
export type ViewArgs =
	| { kind: "run"; port?: number; brainPath?: string }
	| { kind: "help" }
	| { kind: "invalid"; message: string };
