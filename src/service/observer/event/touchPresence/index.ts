import { readFile } from "node:fs/promises";
import create from "@/util/runtimePaths/create/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import parseJson from "@/service/observer/event/shared/readObserverRecord/parseJson/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import { schema, type Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { TouchOutcome, TouchPresenceInput } from "@/service/observer/event/types/index.js";
import mergePresence from "./mergePresence/index.js";
import writePresence from "./writePresence/index.js";
import pingObserver from "./pingObserver/index.js";
import shouldRefresh from "./shouldRefresh/index.js";

/**
 * Record one hook call for a Claude session (brief commitments #72, #75, #78,
 * #92): merge it into the session's presence file, write the ended mark when
 * the call ends the observer session and the presence is linked to one, then
 * ping the observer. Presence is refreshed (written, then the observer pinged)
 * when the call changes state, link or transcript path or the stored time is
 * 30 s old; any other call leaves the file and the observer alone, so the
 * stored `at` is the time of the last refresh. The ended mark is written either
 * way. The presence file is always written before any ping, so the observer
 * re-reads current state. Never throws: every failure is a value in the
 * outcome, because a hook must never fail the host. Writes only under the
 * per-user app-data root, never under the project.
 */
export default async function touchPresence(input: TouchPresenceInput): Promise<TouchOutcome> {
	let linkedSessionId: string | null = null;
	let written = false;
	let endedMark: TouchOutcome["endedMark"] = "none";
	let detail: string | undefined;

	try {
		// 1. Folders and the presence path; a bad Claude id throws here and writes nothing.
		const { projectKey } = await create({ projectRoot: input.projectRoot });
		const path = resolvePresenceFile({ projectKey, claudeSessionId: input.claudeSessionId });

		// 2. Merge into what is on disk; a missing or malformed file counts as none.
		const existing = await readExisting(path);
		const merged = mergePresence({ existing, next: input });
		linkedSessionId = merged.sessionId ?? null;

		// 3. Refresh only when it matters: otherwise the file and the observer are left alone.
		const refresh = shouldRefresh({ existing, merged });
		if (refresh && JSON.stringify(merged) !== JSON.stringify(existing)) {
			await writePresence({ path, presence: merged });
			written = true;
		}

		// 4. The ended mark: only for a hook that ends the observer session, and only once linked.
		if (input.endsObserverSession && merged.sessionId !== undefined) {
			try {
				endedMark = await writeEndedMark({
					projectKey,
					mark: { v: 1, sessionId: merged.sessionId, endedAt: input.at, endedBy: "hook" },
				});
			} catch (error) {
				// A failed mark must not skip the ping: the presence is already on disk.
				detail = error instanceof Error ? error.message : String(error);
			}
		}

		// 5. Ping last, after the files are on disk, and only when step 3 refreshed.
		if (!refresh) {
			return { written, linkedSessionId, endedMark, delivered: false, pinged: false, ...(detail !== undefined ? { detail } : {}) };
		}
		const delivered = await pingObserver({ projectKey, claudeSessionId: input.claudeSessionId });
		return { written, linkedSessionId, endedMark, delivered, pinged: true, ...(detail !== undefined ? { detail } : {}) };
	} catch (error) {
		detail = error instanceof Error ? error.message : String(error);
		return { written, linkedSessionId, endedMark, delivered: false, pinged: false, detail };
	}
}

/** The presence record at `path`, or null when it is missing, unreadable or malformed. */
async function readExisting(path: string): Promise<Presence | null> {
	const content = await readFile(path, "utf-8").catch(() => null);
	if (content === null) return null;
	const json = parseJson(content);
	if (json === undefined) return null;
	const parsed = schema.safeParse(json);
	return parsed.success ? parsed.data : null;
}
