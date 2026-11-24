import { z } from "zod";
import { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

/**
 * The one event schema of the observer feature: the recorder validates agent
 * input with `inputSchema`, and the reader and the observer's post endpoint
 * validate stored and posted events with `schema`. Both unions are built from
 * the same per-kind field shapes, so they can never drift. This file is a
 * contract, not an operation, so it has named exports and no default export
 * (src/service/observer/brief.aide commitments #4, #6, #15, #16).
 */

/** Version stamped on every event; bump when the stored shape changes. */
export const SCHEMA_VERSION = 1;

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
const phaseStarted = {
	kind: z.literal("phase_started"),
	phase,
	agent: label,
	module: label,
};
const phaseFinished = {
	kind: z.literal("phase_finished"),
	phase,
	agent: label,
	module: label,
	result: label.optional(),
	summary: text.optional(),
};
const gateWaiting = {
	kind: z.literal("gate_waiting"),
	gate: label,
	file: path,
};
const gateResolved = {
	kind: z.literal("gate_resolved"),
	gate: label,
	file: path,
	resolution: label.optional(),
};
const planStepChecked = {
	kind: z.literal("plan_step_checked"),
	module: label,
	step: z.string().min(1).max(32),
	total: z.number().int().min(1).optional(),
};
const qaVerdict = {
	kind: z.literal("qa_verdict"),
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

/** Server-stamped fields the agent never supplies (brief commitment #15). */
const envelope = {
	v: z.literal(SCHEMA_VERSION),
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

/** A stored or posted event: the envelope plus the same per-kind shapes. */
export const schema = z.discriminatedUnion("kind", [
	z.object({ ...envelope, ...sessionStarted }).strict(),
	z.object({ ...envelope, ...prompt }).strict(),
	z.object({ ...envelope, ...task }).strict(),
	z.object({ ...envelope, ...phaseStarted }).strict(),
	z.object({ ...envelope, ...phaseFinished }).strict(),
	z.object({ ...envelope, ...gateWaiting }).strict(),
	z.object({ ...envelope, ...gateResolved }).strict(),
	z.object({ ...envelope, ...planStepChecked }).strict(),
	z.object({ ...envelope, ...qaVerdict }).strict(),
	z.object({ ...envelope, ...fileWritten }).strict(),
	z.object({ ...envelope, ...commit }).strict(),
	z.object({ ...envelope, ...release }).strict(),
	z.object({ ...envelope, ...error }).strict(),
]);

/** What the agent sends to record one event. */
export type ObserverEventInput = z.infer<typeof inputSchema>;

/** One stored event: the server-stamped envelope plus the kind's fields. */
export type ObserverEvent = z.infer<typeof schema>;

/** The `session_started` event exactly as recorded. */
export type SessionStartedEvent = Extract<ObserverEvent, { kind: "session_started" }>;
