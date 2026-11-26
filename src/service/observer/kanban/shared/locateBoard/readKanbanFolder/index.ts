import { join } from "node:path";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import type { BoardUnavailable } from "@/service/observer/kanban/types/index.js";
import boardUnavailable from "../../boardUnavailable/index.js";

/**
 * Reads the board location from the project's brain config through `parseBrainAide`
 * (the one reader, observer brief commitments 109 and 81). Answers the configured
 * kanban folder, or the unavailable result naming why the config does not give one.
 * Never throws, reads nothing else, and never derives the folder from the launcher.
 */
export default async function readKanbanFolder({
	projectRoot,
}: {
	projectRoot: string;
}): Promise<{ state: "configured"; kanbanFolder: string } | BoardUnavailable> {
	const config = await parseBrainAide(projectRoot);

	if (config.kind === "missing") {
		const configPath = join(projectRoot, ".aide", "config", "brain.aide");
		return boardUnavailable({ reason: "no-brain-config", detail: `${configPath} does not exist` });
	}

	if (config.kind === "unreadable" || config.kind === "malformed-frontmatter" || config.kind === "malformed-body") {
		return boardUnavailable({
			reason: "brain-config-unreadable",
			detail: `the brain config cannot be read: ${config.reason}`,
		});
	}

	const { kanban } = config;
	if (!kanban) {
		return boardUnavailable({ reason: "no-kanban-field", detail: "the brain config declares no kanban field" });
	}

	if (kanban.state === "malformed") {
		return boardUnavailable({
			reason: kanban.field === "kanban.source" ? "unsupported-source" : "kanban-field-malformed",
			detail: `the brain config's ${kanban.field} ${kanban.fault}`,
		});
	}

	if (kanban.path === null) {
		return boardUnavailable({
			reason: "no-kanban-field",
			detail: "the brain config's kanban.path is not filled in yet",
		});
	}

	return { state: "configured", kanbanFolder: kanban.path };
}
