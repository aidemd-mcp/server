import { z } from "zod";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

/**
 * The one event schema of the observer feature: the recorder validates agent
 * input with `inputSchema`, and the reader and the observer's post endpoint
 * validate stored and posted events with `schema`. Both unions are built from
 * the same per-kind field shapes, so they can never drift. This file is a
 * contract, not an operation, so it has named exports and no default export
 * (src/service/observer/brief.aide commitments #4, #6, #15, #16, #68).
 *
 * Version 2 adds pipelines (commitment #68): three new kinds and a `pipeline`
 * on six existing ones. Recorded lines of version 1 are history, not
 * corruption: `schema` still reads them, so a v1 `phase_started` without a
 * `pipeline` is valid, a v2 one is not, and the three new kinds exist only in
 * v2. New events are always stamped with `SCHEMA_VERSION`.
 */

/** Version stamped on every new event; bump when the stored shape changes. */
export const SCHEMA_VERSION = 2;

/** Longest accepted label: names, slugs, agent, module, gate, column, result, version. */
export const LABEL_MAX = 200;
/** Longest accepted path. */
export const PATH_MAX = 1024;
/** Longest accepted summary or message. */
export const TEXT_MAX = 4000;
/** Longest accepted prompt text. */
export const PROMPT_MAX = 100_000;

const label = z.string().min(1).max(LABEL_MAX);
const path = z.string().min(1).max(PATH_MAX);
const text = z.string().min(1).max(TEXT_MAX);

/** The closed list of pipeline phases (brief commitments #16, #27). */
const phase = z.enum([
	"spec",
	"research",
	"synthesize",
	"structure",
	"plan",
	"build",
	"qa",
	"fix",
	"align",
	"refactor",
	"cleanup",
]);

/** What the agent sends: `kind` plus that kind's fields. */
const sessionStarted = {
	kind: z.literal("session_started"),
	projectRoot: path.optional(),
	kanbanTag: label.optional(),
	brainPath: path.optional(),
};
const prompt = {
	kind: z.literal("prompt"),
	text: z.string().min(1).max(PROMPT_MAX),
};
const task = {
	kind: z.literal("task"),
	slug: label,
	title: label.optional(),
	action: z.enum(["picked", "moved"]),
	column: label.optional(),
};
const pipelineStarted = {
	kind: z.literal("pipeline_started"),
	pipeline: label,
	phase,
};
const pipelineFinished = {
	kind: z.literal("pipeline_finished"),
	pipeline: label,
	result: z.enum(["completed", "abandoned"]),
};
const phaseSkipped = {
	kind: z.literal("phase_skipped"),
	pipeline: label,
	phase,
	reason: label,
};
const phaseStarted = {
	kind: z.literal("phase_started"),
	pipeline: label,
	phase,
	agent: label,
	module: label,
};
const phaseFinished = {
	kind: z.literal("phase_finished"),
	pipeline: label,
	phase,
	agent: label,
	module: label,
	result: label.optional(),
	summary: text.optional(),
};
const gateWaiting = {
	kind: z.literal("gate_waiting"),
	pipeline: label,
	gate: label,
	file: path,
};
const gateResolved = {
	kind: z.literal("gate_resolved"),
	pipeline: label,
	gate: label,
	file: path,
	resolution: label.optional(),
};
const planStepChecked = {
	kind: z.literal("plan_step_checked"),
	pipeline: label,
	module: label,
	step: z.string().min(1).max(32),
	total: z.number().int().min(1).optional(),
};
const qaVerdict = {
	kind: z.literal("qa_verdict"),
	pipeline: label,
	module: label,
	verdict: z.enum(["passed", "issues"]),
	open: z.number().int().min(0).optional(),
};
const fileWritten = {
	kind: z.literal("file_written"),
	path,
	action: z.enum(["created", "updated"]),
};
const commit = {
	kind: z.literal("commit"),
	sha: z.string().regex(/^[0-9a-f]{7,40}$/),
	message: text.optional(),
};
const release = {
	kind: z.literal("release"),
	version: label,
};
const error = {
	kind: z.literal("error"),
	message: text,
	agent: label.optional(),
	module: label.optional(),
};

/**
 * The stored form of a kind that gained `pipeline` in v2: the field is
 * optional in the object so a v1 line still parses, and the refinement on
 * `schema` requires it from v2 on.
 */
function stored<T extends { pipeline: typeof label }>(shape: T) {
	return { ...shape, pipeline: label.optional() };
}

/** The kinds whose stored form needs `pipeline` from v2 on. */
const PIPELINE_REQUIRED_KINDS: ReadonlySet<string> = new Set([
	"phase_started",
	"phase_finished",
	"gate_waiting",
	"gate_resolved",
	"plan_step_checked",
	"qa_verdict",
]);

/** The kinds that exist only from v2 on. */
const V2_ONLY_KINDS: ReadonlySet<string> = new Set([
	"pipeline_started",
	"pipeline_finished",
	"phase_skipped",
]);

/** Server-stamped fields the agent never supplies (brief commitment #15). */
const envelope = {
	v: z.union([z.literal(1), z.literal(2)]),
	ts: z.string().datetime(),
	sessionId: z.string().regex(SESSION_ID_PATTERN),
	seq: z.number().int().min(1),
	pid: z.number().int().min(1),
};

/** Agent-supplied input: one strict object per kind, no envelope field accepted. */
export const inputSchema = z.discriminatedUnion("kind", [
	z.object(sessionStarted).strict(),
	z.object(prompt).strict(),
	z.object(task).strict(),
	z.object(pipelineStarted).strict(),
	z.object(pipelineFinished).strict(),
	z.object(phaseSkipped).strict(),
	z.object(phaseStarted).strict(),
	z.object(phaseFinished).strict(),
	z.object(gateWaiting).strict(),
	z.object(gateResolved).strict(),
	z.object(planStepChecked).strict(),
	z.object(qaVerdict).strict(),
	z.object(fileWritten).strict(),
	z.object(commit).strict(),
	z.object(release).strict(),
	z.object(error).strict(),
]);

/**
 * A stored or posted event: the envelope plus the same per-kind shapes. The
 * two refinements carry the version rules: a v2 event of the six pipeline
 * kinds must name its pipeline, and a v1 event cannot be one of the three
 * kinds that arrived in v2.
 */
export const schema = z
	.discriminatedUnion("kind", [
		z.object({ ...envelope, ...sessionStarted }).strict(),
		z.object({ ...envelope, ...prompt }).strict(),
		z.object({ ...envelope, ...task }).strict(),
		z.object({ ...envelope, ...pipelineStarted }).strict(),
		z.object({ ...envelope, ...pipelineFinished }).strict(),
		z.object({ ...envelope, ...phaseSkipped }).strict(),
		z.object({ ...envelope, ...stored(phaseStarted) }).strict(),
		z.object({ ...envelope, ...stored(phaseFinished) }).strict(),
		z.object({ ...envelope, ...stored(gateWaiting) }).strict(),
		z.object({ ...envelope, ...stored(gateResolved) }).strict(),
		z.object({ ...envelope, ...stored(planStepChecked) }).strict(),
		z.object({ ...envelope, ...stored(qaVerdict) }).strict(),
		z.object({ ...envelope, ...fileWritten }).strict(),
		z.object({ ...envelope, ...commit }).strict(),
		z.object({ ...envelope, ...release }).strict(),
		z.object({ ...envelope, ...error }).strict(),
	])
	.refine(
		(event) =>
			!(
				event.v === 2 &&
				PIPELINE_REQUIRED_KINDS.has(event.kind) &&
				!("pipeline" in event && event.pipeline)
			),
		{ message: "a v2 event of this kind must name its pipeline" },
	)
	.refine((event) => !(event.v === 1 && V2_ONLY_KINDS.has(event.kind)), {
		message: "this kind does not exist in schema v1",
	});

/** What the agent sends to record one event. */
export type ObserverEventInput = z.infer<typeof inputSchema>;

/** One stored event: the server-stamped envelope plus the kind's fields. */
export type ObserverEvent = z.infer<typeof schema>;

/** The `session_started` event exactly as recorded. */
export type SessionStartedEvent = Extract<ObserverEvent, { kind: "session_started" }>;
