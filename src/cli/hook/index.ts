import type { Readable } from "node:stream";
import touchPresence from "@/service/observer/event/touchPresence/index.js";
import readStdin from "./readStdin/index.js";
import parseHookInput from "./parseHookInput/index.js";
import resolveHookRoot from "./resolveHookRoot/index.js";
import mapHookEvent from "./mapHookEvent/index.js";
import findLinkedSession from "./findLinkedSession/index.js";

const STDIN_LIMIT_BYTES = 8 * 1024 * 1024;
const DEADLINE_MS = 1000;

/**
 * Handles one Claude Code hook call (`aidemd-mcp hook`): reads the hook input
 * from stdin, maps it to the session's presence (working, waiting, ended),
 * links the Claude session to its observer session when the input is an
 * `aide_observer_event` reply, and hands it to `touchPresence`, which writes
 * presence first and then pings a running observer (brief commitments #78,
 * #87, #89, #90, #92).
 *
 * Contract: never throws, never starts the observer, never ends any session
 * but its own, and settles within 1 000 ms whatever stdin does (the deadline
 * sits below SessionEnd's 1.5 s default, so the end mark is written or
 * abandoned before Claude Code kills the process). It writes nothing to stdout
 * or stderr: on SessionStart and UserPromptSubmit a hook's stdout becomes
 * model context, and a failing hook must never disturb the host.
 */
export default async function hook({
	stdin = process.stdin,
	env = process.env,
	now = () => new Date(),
}: {
	stdin?: Readable;
	env?: NodeJS.ProcessEnv;
	now?: () => Date;
} = {}): Promise<void> {
	let timer: NodeJS.Timeout | undefined;
	const deadline = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, DEADLINE_MS);
		timer.unref();
	});

	try {
		await Promise.race([record({ stdin, env, now }), deadline]);
	} catch {
		// A hook must never fail the host; the swallow is the contract.
	} finally {
		clearTimeout(timer);
	}
}

/** The work the deadline races: read, parse, map, then touch presence; any null step ends it quietly. */
async function record({
	stdin,
	env,
	now,
}: {
	stdin: Readable;
	env: NodeJS.ProcessEnv;
	now: () => Date;
}): Promise<void> {
	const text = await readStdin({ stream: stdin, limit: STDIN_LIMIT_BYTES });
	if (text === null) return;

	const input = parseHookInput(text);
	if (input === null) return;

	const projectRoot = resolveHookRoot({ env, cwd: input.cwd });
	if (projectRoot === null) return;

	const mapping = mapHookEvent(input);
	if (mapping === null) return;

	await touchPresence({
		projectRoot,
		claudeSessionId: input.session_id,
		hookEvent: mapping.hookEvent,
		state: mapping.state,
		at: now().toISOString(),
		transcriptPath: input.transcript_path,
		linkSessionId: findLinkedSession(input) ?? undefined,
		endsObserverSession: mapping.endsObserverSession,
	});
}
