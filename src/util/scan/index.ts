import { open, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { AideFile, AideFrontmatter, AlignmentValue, ScanResult, WorkStatus } from "@/types/index.js";
import { classifyFile } from "@/util/classify/index.js";
import { SKIP_DIRS } from "@/types/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import classifyAideFile from "@/tools/frontmatter/classifyAideFile/index.js";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import { GOVERNED_FIELDS, LEGACY_ALIGNMENT_KEY } from "@/tools/frontmatter/governedFields/index.js";
import type { AideFileKind, GovernedKind } from "@/tools/frontmatter/types/index.js";

/** Characters of a file shallow mode parses. */
const SHALLOW_HEAD_CHARS = 500;

/** Bytes that always cover `SHALLOW_HEAD_CHARS` characters: UTF-8 spends at most 3 bytes per UTF-16 code unit. */
const SHALLOW_HEAD_BYTES = SHALLOW_HEAD_CHARS * 3;

/** The governed values a scanned file carries: alignment for intent specs, work status for plans and todo lists. */
type GovernedFields = { alignment?: AlignmentValue; workStatus?: WorkStatus };

/** Count checked and total checkbox items in content. */
function countCheckboxes(content: string): { done: number; total: number } {
	const lines = content.split("\n");
	let done = 0;
	let total = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
			done++;
			total++;
		} else if (trimmed.startsWith("- [ ]")) {
			total++;
		}
	}
	return { done, total };
}

/** Narrows a file kind to the three kinds scan reads a governed value from; briefs, research, session and config files carry none scan surfaces. */
function isScannedKind(kind: AideFileKind): kind is Extract<GovernedKind, "intent-spec" | "plan" | "todo"> {
	return kind === "intent-spec" || kind === "plan" || kind === "todo";
}

/** Places a governed value under the field its file kind carries: alignment for intent specs, work status for plans and todo lists. */
function placeGovernedValue(kind: Extract<GovernedKind, "intent-spec" | "plan" | "todo">, value: string): GovernedFields {
	return kind === "intent-spec" ? { alignment: value as AlignmentValue } : { workStatus: value as WorkStatus };
}

/**
 * Reads a file's governed value through `readGovernedValue` with an explicit kind,
 * so a plan's status is never taken for alignment. Only a value in the kind's set
 * is returned; other kinds read nothing.
 */
function readGovernedFields(content: string, kind: AideFileKind): GovernedFields {
	if (!isScannedKind(kind)) return {};
	const read = readGovernedValue({ content, kind });
	if (read.status !== "ok" || read.current.state !== "set") return {};
	return placeGovernedValue(kind, read.current.value);
}

/**
 * True when a shallow head opens a frontmatter block that the 500-byte cut never
 * closes (or cuts mid-structure), so `readGovernedValue` cannot decide and the
 * regex fallback must.
 */
function isCutBlock(head: string, kind: AideFileKind): boolean {
	if (!isScannedKind(kind)) return false;
	if (!head.trimStart().startsWith("---")) return false;
	const read = readGovernedValue({ content: head, kind });
	if (read.status === "unparsable") return true;
	return read.current.state === "not-set" && read.edit.kind === "none";
}

/**
 * Matches the governed key line in a cut frontmatter head: for an intent spec a
 * column-0 `alignment:` line, else a column-0 `status:` line (the older name); for a
 * plan or todo list a column-0 `status:` line. Only a value in `GOVERNED_FIELDS` for
 * that kind is accepted.
 */
function extractGovernedFields(head: string, kind: AideFileKind): GovernedFields {
	if (!isScannedKind(kind)) return {};
	const { field, values } = GOVERNED_FIELDS[kind];
	const keys = kind === "intent-spec" ? [field, LEGACY_ALIGNMENT_KEY] : [field];
	for (const key of keys) {
		const match = head.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"));
		if (match && (values as readonly string[]).includes(match[1])) return placeGovernedValue(kind, match[1]);
	}
	return {};
}

/**
 * Extract description directly from raw frontmatter text using regex. Used as a
 * fallback when the YAML block is too large for parseFrontmatter to find the
 * closing `---` in the truncated head.
 */
function extractShallowDescription(head: string): string {
	let description = "";

	// Match `description:` with either inline value or YAML block scalar (> or |)
	const descMatch = head.match(/^description:\s*[>|]?\s*\n((?:[ \t]+\S.*\n?)+)/m)
		?? head.match(/^description:\s*(.+)$/m);
	if (descMatch) {
		// For block scalars, join indented continuation lines; for inline, take the capture directly.
		const raw = descMatch[1].replace(/\n\s*/g, " ").trim();
		description = raw;
	}

	// Fall back to first sentence of intent if no description found.
	if (!description) {
		const intentMatch = head.match(/^intent:\s*[>|]?\s*\n((?:[ \t]+\S.*\n?)+)/m)
			?? head.match(/^intent:\s*(.+)$/m);
		if (intentMatch) {
			const raw = intentMatch[1].replace(/\n\s*/g, " ").trim();
			description = raw.split(/[.\n]/)[0] ?? "";
		}
	}

	return description;
}

/**
 * Reads the first `SHALLOW_HEAD_CHARS` characters of a file without reading the rest:
 * a bounded byte read through a file handle, decoded, then cut to the same character
 * count a full read would have been sliced to.
 */
async function readHead(fullPath: string): Promise<string> {
	const handle = await open(fullPath, "r");
	try {
		const buf = Buffer.alloc(SHALLOW_HEAD_BYTES);
		const { bytesRead } = await handle.read(buf, 0, SHALLOW_HEAD_BYTES, 0);
		return buf.toString("utf-8", 0, bytesRead).slice(0, SHALLOW_HEAD_CHARS);
	} finally {
		await handle.close();
	}
}

/** Normalize a Windows or mixed path to POSIX forward slashes. */
function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/**
 * Derive a description from frontmatter, falling back to the first sentence of
 * `intent` when `description` is absent — matching the logic in buildAncestorChain.
 */
function deriveDescription(frontmatter: AideFrontmatter | null | undefined): string {
	if (frontmatter?.description) return frontmatter.description;
	if (frontmatter?.intent) return frontmatter.intent.split(/[.\n]/)[0] ?? "";
	return "";
}

/**
 * Recursively walk a directory and collect all .aide files, reading each file's
 * description and governed value (alignment on intent specs, workStatus on plans
 * and todo lists) by its kind.
 */
async function walk(dir: string, root: string, files: AideFile[], shallow: boolean): Promise<void> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (SKIP_DIRS.includes(entry.name as (typeof SKIP_DIRS)[number])) continue;
			await walk(fullPath, root, files, shallow);
			continue;
		}

		if (!entry.name.endsWith(".aide")) continue;

		let summary = "";
		let description = "";
		let governed: GovernedFields = {};
		let parseError: string | undefined;

		const type = classifyFile(entry.name);
		const kind = classifyAideFile(entry.name);

		if (!shallow) {
			try {
				const buf = await readFile(fullPath, { encoding: "utf-8" });
				const result = parseFrontmatter(buf);
				description = deriveDescription(result.frontmatter);
				governed = readGovernedFields(buf, kind);
				if (result.parseError) parseError = result.parseError;

				if (type === "plan" || type === "todo") {
					const { done, total } = countCheckboxes(buf);
					summary = total > 0 ? `${done}/${total} done` : "";
				}
			} catch {
				// skip unreadable files
			}
		} else {
			// In shallow mode, read only the first 500 characters of the file.
			// Intent specs often have frontmatter >3 KB (scope, description, intent,
			// outcomes), so the 500-character head may not contain the closing `---`.
			// When parseFrontmatter returns null, fall back to regex extraction.
			try {
				const head = await readHead(fullPath);
				const { frontmatter } = parseFrontmatter(head);
				description = frontmatter ? deriveDescription(frontmatter) : extractShallowDescription(head);
				governed = isCutBlock(head, kind) ? extractGovernedFields(head, kind) : readGovernedFields(head, kind);
			} catch {
				// skip unreadable files
			}
		}

		files.push({
			path: fullPath,
			relativePath: toPosix(relative(root, fullPath)),
			type,
			summary,
			description,
			...governed,
			parseError,
		});
	}
}

/**
 * Recursively walk the filesystem from `root` and collect all .aide files.
 * Skips node_modules, .git, dist, build, .next, coverage, __pycache__.
 * In deep mode: reads full content to extract summary, description, and the governed
 * value (`alignment` on intent specs, `workStatus` on plan.aide and todo.aide).
 * In shallow mode: reads only the first 500 characters of each file (a bounded read, never the whole file) to extract frontmatter
 * description and the governed value — summary stays empty but descriptions appear
 * unconditionally. When the head holds no closed frontmatter block, a regex fallback
 * reads the governed key lines instead.
 */
export default async function scan(root: string, path?: string, shallow?: boolean): Promise<ScanResult> {
	const scanRoot = path ? join(root, path) : root;
	const files: AideFile[] = [];
	await walk(scanRoot, root, files, !!shallow);
	return { root, files };
}
