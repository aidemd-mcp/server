import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent } from "@/types/index.js";
import baseName from "@/util/baseName/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";
import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerItem, HistoryKind } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import fileFolder from "./fileFolder/index.js";
import findPreviousColumn from "./findPreviousColumn/index.js";
import findRound from "./findRound/index.js";
import findStartedAt from "./findStartedAt/index.js";
import findWaited from "./findWaited/index.js";
import firstLine from "@/util/firstLine/index.js";

type Label = { kind: HistoryKind; label: string; mono: string | null; meta: string | null; target: DrawerItem | null };

/** The span between two instants as the handoff writes it (`2m 10s`). */
function spanBetween({ from, to }: { from: string; to: string }): string {
	return formatSpan((Date.parse(to) - Date.parse(from)) / 1000);
}

/**
 * Words one event as the history row the handoff draws: its kind, label, mono part (slug, file,
 * sha, version), meta line and what a click opens. Every value comes from the event's own fields or
 * from earlier events of the project (`events`, all held, any order): the duration of a finished
 * phase, the round of a Fix or QA verdict, how long a gate waited, the column a task moved from.
 * A value no event reported is left out, never guessed. `projectRoot` (`""` when unknown) turns
 * recorded paths into the project-relative form the drawer opens.
 */
export default function labelEvent({
	event,
	events,
	projectRoot,
}: {
	event: ObserverEvent;
	events: ObserverEvent[];
	projectRoot: string;
}): Label {
	const relative = (path: string): string => normalizeModule({ projectRoot, module: path });
	const sameModule =
		(module: string) =>
		(other: string): boolean =>
			relative(other) === relative(module);
	const eventItem: DrawerItem = { kind: "event", sessionId: event.sessionId, seq: event.seq };

	switch (event.kind) {
		case "session_started":
			return {
				kind: "start",
				label: "Session started",
				mono: null,
				meta: joinMeta([event.projectRoot, event.kanbanTag === undefined ? null : `kanban ${event.kanbanTag}`]),
				target: eventItem,
			};
		case "prompt":
			return { kind: "prompt", label: `Prompt: “${firstLine({ text: event.text })}”`, mono: null, meta: null, target: eventItem };
		case "task": {
			const from = findPreviousColumn({ event, events });
			const meta = event.column === undefined ? null : from === null ? `→ ${event.column}` : `${from} → ${event.column}`;
			return {
				kind: "task",
				label: event.action === "picked" ? "Picked task" : "Moved task",
				mono: event.slug,
				meta,
				target: { kind: "task", slug: event.slug },
			};
		}
		case "pipeline_started":
			return {
				kind: "pipeline",
				label: `Pipeline ${event.pipeline} started at ${PHASE_LABELS[event.phase]}`,
				mono: null,
				meta: null,
				target: eventItem,
			};
		case "pipeline_finished":
			return { kind: "pipeline", label: `Pipeline ${event.pipeline} ${event.result}`, mono: null, meta: null, target: eventItem };
		case "phase_skipped":
			return { kind: "skip", label: `${PHASE_LABELS[event.phase]} skipped`, mono: null, meta: event.reason, target: eventItem };
		case "phase_started": {
			const round =
				event.phase === "fix"
					? Math.max(findRound({ events, sessionId: event.sessionId, seq: event.seq, inclusive: false, sameModule: sameModule(event.module) }), 1)
					: null;
			return {
				kind: "phase",
				label: `${PHASE_LABELS[event.phase]} started${round === null ? "" : ` · round ${round}`}`,
				mono: null,
				meta: joinMeta([event.agent, event.module]),
				target: { kind: "module", folder: relative(event.module) },
			};
		}
		case "phase_finished": {
			const startedAt = findStartedAt({ finished: event, events });
			const duration = startedAt === null ? "" : ` · ${spanBetween({ from: startedAt, to: event.ts })}`;
			return {
				kind: "done",
				label: `${PHASE_LABELS[event.phase]} finished${duration}`,
				mono: null,
				meta: joinMeta([event.summary === undefined ? event.result : firstLine({ text: event.summary })]),
				target: eventItem,
			};
		}
		case "gate_waiting": {
			const file = relative(event.file);
			return {
				kind: "wait",
				label: "Waiting on you — approve",
				mono: baseName(file),
				meta: fileFolder(file),
				target: { kind: "file", path: file },
			};
		}
		case "gate_resolved": {
			const file = relative(event.file);
			const waitingAt = findWaited({ resolved: event, events, sameFile: (other) => relative(other) === file });
			const approved = event.resolution === undefined || event.resolution.toLowerCase() === "approved";
			return {
				kind: "approve",
				label: approved ? "Approved" : `Resolved (${event.resolution})`,
				mono: baseName(file),
				meta: waitingAt === null ? null : `waited ${spanBetween({ from: waitingAt, to: event.ts })}`,
				target: { kind: "file", path: file },
			};
		}
		case "plan_step_checked":
			return {
				kind: "step",
				label: `Plan step checked · ${event.step}${event.total === undefined ? "" : `/${event.total}`}`,
				mono: null,
				meta: relative(event.module),
				target: { kind: "module", folder: relative(event.module) },
			};
		case "qa_verdict": {
			const module = relative(event.module);
			if (event.verdict === "passed") return { kind: "pass", label: "QA passed", mono: null, meta: `${module} · 0 open`, target: eventItem };
			const round = findRound({ events, sessionId: event.sessionId, seq: event.seq, inclusive: true, sameModule: sameModule(event.module) });
			return {
				kind: "issues",
				label: event.open === undefined ? "QA found issues" : `QA found ${event.open} ${event.open === 1 ? "issue" : "issues"}`,
				mono: null,
				meta: joinMeta([module, event.open === undefined ? null : `${event.open} open`, `round ${round}`]),
				target: eventItem,
			};
		}
		case "file_written": {
			const path = relative(event.path);
			return { kind: "sub", label: path, mono: null, meta: null, target: { kind: "file", path } };
		}
		case "commit":
			return {
				kind: "commit",
				label: "Commit",
				mono: event.sha.slice(0, 7),
				meta: event.message === undefined ? null : firstLine({ text: event.message }),
				target: eventItem,
			};
		case "release":
			return { kind: "release", label: "Release", mono: event.version, meta: null, target: eventItem };
		case "error":
			return {
				kind: "error",
				label: `Error: ${firstLine({ text: event.message })}`,
				mono: null,
				meta: joinMeta([event.agent, event.module]),
				target: eventItem,
			};
	}
}
