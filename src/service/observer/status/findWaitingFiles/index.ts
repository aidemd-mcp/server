import type { ObserverEvent } from "@/types/index.js";
import normalizeProjectPath from "../shared/normalizeProjectPath/index.js";
import type { ModuleNode, TreeFileEntry, WaitingFile } from "../types/index.js";

type GateEvent = Extract<ObserverEvent, { kind: "gate_waiting" | "gate_resolved" }>;

/** A gate event whose file path is already normalized to the project-relative form. */
type NormalizedGateEvent<K extends GateEvent["kind"]> = {
	event: Extract<GateEvent, { kind: K }>;
	file: string;
};

/** Orders two events newest first: `ts` descending, then `seq` within one session, else `sessionId` descending. */
function compareNewestFirst(a: ObserverEvent, b: ObserverEvent): number {
	const byTime = Date.parse(b.ts) - Date.parse(a.ts);
	if (byTime !== 0) return byTime;
	if (a.sessionId === b.sessionId) return b.seq - a.seq;
	return a.sessionId < b.sessionId ? 1 : -1;
}

/** True when `resolved` comes after `waiting`: a higher `seq` in the same session, a strictly later `ts` in another. */
function resolvesWaiting({ waiting, resolved }: { waiting: ObserverEvent; resolved: ObserverEvent }): boolean {
	if (waiting.sessionId === resolved.sessionId) return resolved.seq > waiting.seq;
	return Date.parse(resolved.ts) > Date.parse(waiting.ts);
}

/** True when the tree entry still awaits the user: a proposed plan/todo/brief, or any intent spec that exists. */
function stillAwaitsApproval(entry: TreeFileEntry): boolean {
	if (entry.kind === "intent") return true;
	if (entry.kind === "plan" || entry.kind === "todo" || entry.kind === "brief") {
		return entry.read.state === "present" && entry.read.status === "proposed";
	}
	return false;
}

/**
 * Finds the files the user is being waited on for: every file named by an open
 * `gate_waiting` event (no later `gate_resolved` for it) that the tree says
 * still awaits approval. Files decide: a plan approved by hand, a deleted file
 * or a malformed one is never shown, whatever the events say. The first result
 * is the file `buildStatus` surfaces; this function never decides when the page
 * opens it.
 */
export default function findWaitingFiles({
	projectRoot,
	events,
	nodes,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	nodes: ModuleNode[];
}): WaitingFile[] {
	// Step 1: normalize the file of every gate event; an event outside the project is ignored.
	const waitingEvents: NormalizedGateEvent<"gate_waiting">[] = [];
	const resolvedEvents: NormalizedGateEvent<"gate_resolved">[] = [];
	for (const event of events) {
		if (event.kind !== "gate_waiting" && event.kind !== "gate_resolved") continue;
		const file = normalizeProjectPath({ projectRoot, path: event.file });
		if (file === null) continue;
		if (event.kind === "gate_waiting") waitingEvents.push({ event, file });
		else resolvedEvents.push({ event, file });
	}

	// Step 2: a waiting event is open unless a later resolution names the same file.
	const open = waitingEvents.filter(
		(waiting) =>
			!resolvedEvents.some(
				(resolved) =>
					resolved.file === waiting.file &&
					resolvesWaiting({ waiting: waiting.event, resolved: resolved.event }),
			),
	);

	// Step 3: the tree entry for each file, judged only from the files themselves.
	const entries = new Map<string, TreeFileEntry>();
	for (const node of nodes) for (const entry of node.files) entries.set(entry.file, entry);

	// Step 4: newest first, so the first open event seen per file is the one that stays.
	const newestFirst = [...open].sort((a, b) => compareNewestFirst(a.event, b.event));
	const waiting: WaitingFile[] = [];
	const seen = new Set<string>();
	for (const { event, file } of newestFirst) {
		if (seen.has(file)) continue;
		seen.add(file);

		const entry = entries.get(file);
		if (!entry || !stillAwaitsApproval(entry)) continue;

		// Step 5: file, folder and kind come from the tree; gate, session, seq and since from the event.
		waiting.push({
			file,
			folder: entry.folder,
			kind: entry.kind,
			gate: event.gate,
			sessionId: event.sessionId,
			seq: event.seq,
			since: event.ts,
		});
	}
	return waiting;
}
