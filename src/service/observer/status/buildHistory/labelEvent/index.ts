import type { ObserverEvent } from "@/types/index.js";
import type { HistoryRow } from "../../types/index.js";
import PHASE_LABELS from "../../shared/phaseLabels/index.js";
import baseName from "@/util/baseName/index.js";
import firstLine from "@/util/firstLine/index.js";
import formatDuration from "../formatDuration/index.js";

/**
 * Describes one event as a single history line, plus the detail the page shows
 * when the row is opened. Module and agent text are shown as recorded.
 * `startedAt` is the `ts` of the matching `phase_started`, used only to turn a
 * `phase_finished` into a duration.
 */
export default function labelEvent({
	event,
	startedAt,
}: {
	event: ObserverEvent;
	startedAt?: string;
}): Pick<HistoryRow, "label" | "detail"> {
	switch (event.kind) {
		case "session_started": {
			const lines = [
				event.projectRoot ? `Project root: ${event.projectRoot}` : null,
				event.kanbanTag ? `Kanban tag: ${event.kanbanTag}` : null,
				event.brainPath ? `Brain folder: ${event.brainPath}` : null,
			].filter((line): line is string => line !== null);
			if (lines.length === 0) return { label: "Session started" };
			return { label: "Session started", detail: { text: lines.join("\n") } };
		}
		case "prompt":
			return { label: `You: "${firstLine({ text: event.text, ellipsis: true })}"`, detail: { text: event.text } };
		case "task": {
			const name = event.title ?? event.slug;
			if (event.action === "picked") return { label: `Task picked: ${name}`, detail: { slug: event.slug } };
			const column = event.column ? ` → ${event.column}` : "";
			return { label: `Task: ${name}${column}`, detail: { slug: event.slug } };
		}
		case "pipeline_started":
			return { label: `Pipeline ${event.pipeline} started at ${PHASE_LABELS[event.phase]}` };
		case "pipeline_finished":
			return { label: `Pipeline ${event.pipeline} ${event.result}` };
		case "phase_skipped":
			return { label: `${PHASE_LABELS[event.phase]} skipped`, detail: { text: event.reason } };
		case "phase_started":
			return { label: `${PHASE_LABELS[event.phase]} · ${event.agent} · ${event.module}` };
		case "phase_finished": {
			const phase = PHASE_LABELS[event.phase];
			const duration =
				startedAt === undefined ? "" : ` · ${formatDuration(Date.parse(event.ts) - Date.parse(startedAt))}`;
			const result = event.result ? ` · ${event.result}` : "";
			const label = `${phase} done${duration}${result}`;
			if (event.summary === undefined) return { label };
			return { label, detail: { text: event.summary } };
		}
		case "gate_waiting":
			return { label: `Waiting on you: ${baseName(event.file)}`, detail: { file: event.file } };
		case "gate_resolved": {
			const resolution = event.resolution ? ` · ${event.resolution}` : "";
			return { label: `${event.gate} resolved${resolution}`, detail: { file: event.file } };
		}
		case "plan_step_checked": {
			const total = event.total === undefined ? "" : `/${event.total}`;
			return { label: `Build step ${event.step}${total} ✓` };
		}
		case "qa_verdict": {
			if (event.verdict === "passed") return { label: "QA passed" };
			const open = event.open === undefined ? "" : `${event.open} `;
			return { label: `QA: ${open}issues → todo.aide`, detail: { file: `${event.module}/todo.aide` } };
		}
		case "file_written":
			return { label: `${baseName(event.path)} ${event.action}`, detail: { file: event.path } };
		case "commit": {
			const label = `Committed ${event.sha.slice(0, 7)}`;
			if (event.message === undefined) return { label };
			return { label, detail: { text: event.message } };
		}
		case "release":
			return { label: `Released ${event.version}` };
		case "error":
			return { label: event.agent ? `${event.agent} failed` : "Error", detail: { text: event.message } };
	}
}
