import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import {
	readCanonicalDoc,
	type CanonicalDocName,
} from "@/tools/init/initContent/index.js";

/**
 * Fixed registry of the six AIDE pipeline slash commands. Owning this list
 * here — rather than discovering it from .claude/commands/aide/ at runtime — is
 * the mechanical guarantee of the six-phase cap mandated by this helper's
 * spec: a stray Markdown file committed under .claude/commands/aide/ cannot
 * silently expand the pipeline.
 *
 * Host filename layout mirrors the canonical layout exactly: each template is
 * installed at <commandDir>/aide/<phase>.md. The `aide/` subfolder is the
 * namespace, not a filename prefix — host frameworks derive slash-command
 * namespaces from folder nesting, so a file at aide/research.md becomes
 * `/aide:research` on the host. This is the layout .claude/commands/aide/.aide
 * mandates: "filenames must be bare phase names ... the enclosing aide/
 * folder already carries the namespace". Reintroducing an `aide-` filename
 * prefix here would produce `/aide:aide-research` on the host — the exact
 * double-namespace failure the canonical spec names as undesired.
 */
const COMMANDS: readonly {
	canonical: CanonicalDocName;
	hostPath: string;
	displayName: string;
}[] = [
	{ canonical: "commands/aide/research", hostPath: "aide/research.md", displayName: "aide:research" },
	{ canonical: "commands/aide/spec", hostPath: "aide/spec.md", displayName: "aide:spec" },
	{ canonical: "commands/aide/plan", hostPath: "aide/plan.md", displayName: "aide:plan" },
	{ canonical: "commands/aide/build", hostPath: "aide/build.md", displayName: "aide:build" },
	{ canonical: "commands/aide/qa", hostPath: "aide/qa.md", displayName: "aide:qa" },
	{ canonical: "commands/aide/fix", hostPath: "aide/fix.md", displayName: "aide:fix" },
];

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Install the six AIDE pipeline slash commands under <commandDir>/aide/,
 * each a byte-faithful render of its canonical template read via
 * readCanonicalDoc. Existing command files are preserved verbatim so user
 * customizations survive re-runs (idempotency invariant). A failed read for
 * one command surfaces as a `skipped` status for that command only and does
 * not abort the remaining installs — per-command reporting is load-bearing
 * because it is the only signal the caller has for which phases landed on
 * this run.
 */
export default async function scaffoldCommands(commandDir: string): Promise<InitStepResult[]> {
	const results: InitStepResult[] = [];
	await mkdir(commandDir, { recursive: true });

	for (const cmd of COMMANDS) {
		const filePath = join(commandDir, cmd.hostPath);

		if (await fileExists(filePath)) {
			results.push({ name: cmd.displayName, status: "exists" });
			continue;
		}

		let content: string;
		try {
			content = readCanonicalDoc(cmd.canonical);
		} catch {
			results.push({ name: cmd.displayName, status: "skipped" });
			continue;
		}

		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf-8");
		results.push({ name: cmd.displayName, status: "created" });
	}

	return results;
}
