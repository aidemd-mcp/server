import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AideFile, WorkStatus } from "@/types/index.js";
import countCheckboxes from "@/util/countCheckboxes/index.js";
import describeError from "@/util/describeError/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import type { FileProgress, TreeFileEntry, TreeFileKind } from "../../types/index.js";
import toNodeFolder from "../../shared/toNodeFolder/index.js";
import WORK_STATUSES from "./workStatuses/index.js";
import countPlanSteps from "./countPlanSteps/index.js";

/** Reads a brief's `status` from its raw frontmatter, since scan does not surface it. */
function readBriefStatus(content: string): WorkStatus | "unset" {
	const block = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (!block) return "unset";
	const value = (parse(block[1]) as Record<string, unknown> | null)?.status;
	return (WORK_STATUSES as readonly unknown[]).includes(value) ? (value as WorkStatus) : "unset";
}

/** A failed read's short reason: the errno code when there is one, else the message. */
function describeReadFailure(error: unknown): string {
	const code = (error as NodeJS.ErrnoException).code;
	if (code) return code;
	return describeError({ error });
}

/**
 * Reads one AIDE file into its tree entry: alignment (specs) or work status
 * (briefs, plans, todos) plus checkbox progress. A bad file becomes a
 * `malformed` entry instead of throwing, so one file never breaks another.
 * Read-only.
 */
export default async function readTreeFile({ file, kind }: { file: AideFile; kind: TreeFileKind }): Promise<TreeFileEntry> {
	const base = { file: file.relativePath, folder: toNodeFolder(file.relativePath) };
	const malformed = (error: string) => ({ ...base, kind, read: { state: "malformed" as const, error } }) as TreeFileEntry;

	// A frontmatter error scan already found makes the entry malformed.
	if (file.parseError) return malformed(file.parseError);

	// Read the file's text.
	let content: string;
	try {
		content = await readFile(file.path, "utf-8");
	} catch (error) {
		return malformed(describeReadFailure(error));
	}

	// Checkbox progress, from the same counter cleanup uses.
	const counted = countCheckboxes(content);
	const progress: FileProgress = { done: counted.total - counted.open.length, total: counted.total, open: counted.open.length };

	// Research, the session record and other files need no frontmatter.
	if (kind === "research" || kind === "session" || kind === "other") {
		return { ...base, kind, read: { state: "present", progress } };
	}

	// Every other kind requires parseable frontmatter.
	const parsed = parseFrontmatter(content);
	if (parsed.frontmatter === null) return malformed(parsed.parseError ?? "no frontmatter");

	// Intent specs carry alignment and a description.
	if (kind === "intent") {
		return {
			...base,
			kind,
			read: { state: "present", alignment: file.alignment ?? "unset", description: file.description ?? "", progress },
		};
	}

	// Briefs, plans and todos carry a work status; scan reads it for plans and todos only.
	let status: WorkStatus | "unset";
	try {
		status = kind === "brief" ? readBriefStatus(content) : (file.workStatus ?? "unset");
	} catch (error) {
		return malformed(describeReadFailure(error));
	}
	const steps = kind === "plan" ? countPlanSteps(content) : { done: progress.done, total: progress.total };
	return { ...base, kind, read: { state: "present", status, awaitingApproval: status === "proposed", progress, steps } };
}
