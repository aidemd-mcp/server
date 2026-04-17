import {
	listMethodologyDocs,
	listAgents,
	listSkills,
	getCanonicalPath,
} from "@/tools/init/initContent/index.js";
import { COMMANDS } from "@/tools/init/scaffoldCommands/index.js";

/**
 * A single deliverable artifact with its namespaced slug and repo-relative
 * path. The slug is the key that appears in versions.json. The repoPath
 * is passed to `git log -- <repoPath>` to retrieve version metadata.
 */
export interface ArtifactEntry {
	slug: string;
	repoPath: string;
}

/**
 * Return a flat array of every deliverable artifact across all categories.
 * Pure and synchronous — reads only from in-memory registries, performs no I/O.
 *
 * Categories covered:
 * - `docs/*`        — methodology docs (from listMethodologyDocs)
 * - `commands/*`    — slash commands (from COMMANDS)
 * - `agents/*`      — pipeline agent files (from listAgents)
 * - `skills/*`      — skill templates (from listSkills)
 * - `bin/*`         — binary helpers
 * - `extensions/*`  — IDE extensions
 */
export default function enumerateArtifacts(): ArtifactEntry[] {
	const entries: ArtifactEntry[] = [];

	for (const doc of listMethodologyDocs()) {
		entries.push({
			slug: `docs/${doc.hostFilename.replace(/\.md$/, "")}`,
			repoPath: getCanonicalPath(doc.canonical),
		});
	}

	for (const cmd of COMMANDS) {
		// cmd.canonical already carries the category prefix (e.g. "commands/aide/spec")
		// so it is the slug directly — no additional prefix needed.
		entries.push({
			slug: cmd.canonical,
			repoPath: getCanonicalPath(cmd.canonical),
		});
	}

	for (const agent of listAgents()) {
		// agent.canonical already carries the category prefix (e.g. "agents/aide/aide-spec-writer")
		entries.push({
			slug: agent.canonical,
			repoPath: getCanonicalPath(agent.canonical),
		});
	}

	for (const skill of listSkills()) {
		// skill.canonical already carries the category prefix (e.g. "skills/study-playbook")
		entries.push({
			slug: skill.canonical,
			repoPath: getCanonicalPath(skill.canonical),
		});
	}

	entries.push({
		slug: "bin/aide-tree",
		repoPath: ".aide/bin/aide-tree.mjs",
	});

	entries.push({
		slug: "extensions/vscode/aide-markdown",
		repoPath: "extensions/vscode/aide-markdown-0.0.1.vsix",
	});

	return entries;
}
