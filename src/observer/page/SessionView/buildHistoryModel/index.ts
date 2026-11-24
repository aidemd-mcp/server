import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { HistoryModel, HistoryRowModel, SessionRowModel } from "@/observer/page/types/index.js";
import countCategories from "./countCategories/index.js";
import groupFiles from "./groupFiles/index.js";
import KIND_FACTS from "./kindFacts/index.js";
import labelEvent from "./labelEvent/index.js";
import orderEvents from "./orderEvents/index.js";
import pickSessionIds from "./pickSessionIds/index.js";

/**
 * The history panel's data: one row per event of the sessions the view follows (the focused session,
 * or every running one), worded from the events' own fields in the handoff's labels, runs of file
 * writes folded under the row before them, oldest first (the panel reverses for newest first).
 * While two or more sessions share the history each row carries its session's start as a tag and
 * `sessions` lists them for the session filter; otherwise both stay empty. `events` are every
 * event the stream holds for the project; `projectRoot` is `""` when the project reported none.
 */
export default function buildHistoryModel({
	events,
	sessions,
	focus,
	projectRoot,
	now,
}: {
	events: ObserverEvent[];
	sessions: SessionRowModel[];
	focus: string;
	projectRoot: string;
	now: Date;
}): HistoryModel {
	const scoped = orderEvents({ events, sessionIds: pickSessionIds({ sessions, focus, events }) });
	const present = [...new Set(scoped.map((event) => event.sessionId))];
	const starts = present
		.map((id) => ({ id, iso: sessions.find((session) => session.sessionId === id)?.startedAt ?? scoped.find((event) => event.sessionId === id)!.ts }))
		.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.id < b.id ? -1 : 1));
	const labels = starts.map(({ id, iso }) => ({ id, label: formatClock({ iso, now }).clock }));
	const multi = labels.length >= 2;

	const flat = scoped.map((event): HistoryRowModel => {
		const { kind, label, mono, meta, target } = labelEvent({ event, events, projectRoot });
		const facts = KIND_FACTS[kind];
		const { clock, day } = formatClock({ iso: event.ts, now });
		return {
			id: `${event.sessionId}:${event.seq}`,
			sessionId: event.sessionId,
			time: clock,
			day,
			kind,
			category: facts.category,
			icon: facts.icon,
			kindWord: event.kind === "file_written" ? `${event.action}: ` : facts.kindWord,
			label,
			mono,
			meta,
			sessionTag: multi ? (labels.find((entry) => entry.id === event.sessionId)?.label ?? null) : null,
			item: target,
			files: [],
		};
	});

	const rows = groupFiles({ rows: flat });
	return { rows, total: scoped.length, sessions: multi ? labels : [], counts: countCategories({ rows }) };
}
