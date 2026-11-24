import type { ObserverMessage } from "../../types/index.js";

/**
 * The one home for the observer start texts (brief commitment #37) that the start tool and the
 * `view` command both print: `Observer running at`, `Observer already running at`,
 * `Observer not replaced: ...` and `Observer not started: ...`. The caller adds its own newline
 * and, for a started line, its own parenthetical through `note`.
 */
export default function buildObserverMessage(message: ObserverMessage): string {
	switch (message.kind) {
		case "started":
			return message.note === undefined
				? `Observer running at ${message.link}`
				: `Observer running at ${message.link} (${message.note})`;
		case "already-running":
			return `Observer already running at ${message.link}`;
		case "stuck":
			return `Observer not replaced: the running observer is version ${message.runningVersion}, older than this AIDE (${message.ownVersion}), and did not shut down; it is still serving at ${message.link}`;
		case "not-started":
			return `Observer not started: ${message.reason}`;
	}
}
