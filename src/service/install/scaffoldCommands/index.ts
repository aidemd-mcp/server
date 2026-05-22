import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import {
	readCanonicalDoc,
	type CanonicalDocName,
} from "@/service/install/initContent/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";

/**
 * Fixed registry of the /aide orchestrator entry point plus the AIDE pipeline
 * phase commands. Owning this list here — rather than discovering it
 * from .claude/commands/ at runtime — is the mechanical guarantee that a stray
 * Markdown file committed under .claude/commands/aide/ cannot silently expand
 * the pipeline.
 *
 * Layout: the orchestrator is installed at <commandDir>/aide.md — a peer of
 * the `aide/` subfolder, not inside it. Phase commands are installed at
 * <commandDir>/aide/<phase>.md. The `aide/` subfolder is the namespace, not a
 * filename prefix — host frameworks derive slash-command namespaces from folder
 * nesting, so a file at aide/research.md becomes `/aide:research` on the host.
 * This is the layout .claude/commands/aide/.aide mandates: "filenames must be
 * bare phase names ... the enclosing aide/ folder already carries the
 * namespace". Reintroducing an `aide-` filename prefix here would produce
 * `/aide:aide-research` on the host — the exact double-namespace failure the
 * canonical spec names as undesired. The orchestrator lives one level up
 * (aide.md) so it registers as the plain `/aide` command with no colon suffix.
 */
export const COMMANDS: readonly {
	canonical: CanonicalDocName;
	hostPath: string;
	displayName: string;
}[] = [
	{ canonical: "commands/aide/aide", hostPath: "aide.md", displayName: "aide" },
	{ canonical: "commands/aide/research", hostPath: "aide/research.md", displayName: "aide:research" },
	{ canonical: "commands/aide/spec", hostPath: "aide/spec.md", displayName: "aide:spec" },
	{ canonical: "commands/aide/synthesize", hostPath: "aide/synthesize.md", displayName: "aide:synthesize" },
	{ canonical: "commands/aide/plan", hostPath: "aide/plan.md", displayName: "aide:plan" },
	{ canonical: "commands/aide/build", hostPath: "aide/build.md", displayName: "aide:build" },
	{ canonical: "commands/aide/qa", hostPath: "aide/qa.md", displayName: "aide:qa" },
	{ canonical: "commands/aide/fix", hostPath: "aide/fix.md", displayName: "aide:fix" },
	{ canonical: "commands/aide/upgrade", hostPath: "aide/upgrade.md", displayName: "aide:upgrade" },
	{ canonical: "commands/aide/update-playbook", hostPath: "aide/update-playbook.md", displayName: "aide:update-playbook" },
	{ canonical: "commands/aide/refactor", hostPath: "aide/refactor.md", displayName: "aide:refactor" },
	{ canonical: "commands/aide/align", hostPath: "aide/align.md", displayName: "aide:align" },
	{ canonical: "commands/aide/brain", hostPath: "aide/brain.md", displayName: "aide:brain" },
	{ canonical: "commands/aide/handoff", hostPath: "aide/handoff.md", displayName: "aide:handoff" },
];

/**
 * Return planning steps for the /aide orchestrator and pipeline phase commands.
 *
 * For each command in COMMANDS, compares the host file bytes against the
 * canonical content:
 * - `would-create`: file does not exist on disk.
 * - `exists`: file exists and its bytes are identical to canonical.
 * - `would-overwrite`: file exists but its bytes differ from canonical.
 *
 * A failed canonical read returns `would-skip` for that command only and
 * does not affect the other steps.
 *
 * The COMMANDS export stays unchanged — upgrade's logic still uses it.
 * This helper never writes to disk — it is a planner only.
 */
export default async function scaffoldCommands(commandDir: string): Promise<InitStep[]> {
	const steps: InitStep[] = [];

	for (const cmd of COMMANDS) {
		const filePath = join(commandDir, cmd.hostPath);

		let content: string;
		try {
			content = readCanonicalDoc(cmd.canonical);
		} catch {
			steps.push({
				name: cmd.displayName,
				status: "would-skip",
				category: "commands",
				filePath,
			});
			continue;
		}

		const status = await compareBytes(filePath, content);

		if (status === "would-skip") {
			steps.push({
				name: cmd.displayName,
				status: "exists",
				category: "commands",
				filePath,
			});
			continue;
		}

		steps.push({
			name: cmd.displayName,
			status,
			category: "commands",
			filePath,
			content,
		});
	}

	return steps;
}
