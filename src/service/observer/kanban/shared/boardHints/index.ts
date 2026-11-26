import type { BoardUnavailable } from "@/service/observer/kanban/types/index.js";

/**
 * One hint per unavailable-board reason: what the user can do about it. The only
 * place hint text lives; `boardUnavailable` attaches the entry for the reason it
 * is given, so a reason never reaches the page without its hint.
 */
const boardHints = {
	"no-brain-config":
		"The board's location comes from the kanban field of the project's brain config. Run /aide:brain config in the project to create the config, or start the observer from the project's folder with: aidemd-mcp view --kanban <path>",
	"brain-config-unreadable":
		"Fix the brain config fault named above (aide_info reports it too), or start the observer from the project's folder with: aidemd-mcp view --kanban <path>",
	"no-kanban-field":
		"Run /aide:brain config in the project to set the kanban field of its brain config to the brain's kanban folder, or start the observer from the project's folder with: aidemd-mcp view --kanban <path>",
	"kanban-field-malformed":
		"Fix the kanban field in .aide/config/brain.aide: `source: folder` and `path:` the absolute path of the brain's kanban folder. /aide:brain config can set it for you.",
	"unsupported-source":
		"This observer reads only boards kept as plain folders (`source: folder`). Point the kanban field at the brain's kanban folder, or start the observer from the project's folder with: aidemd-mcp view --kanban <path>",
	"kanban-folder-missing":
		"Check that the kanban folder named above exists: the kanban field's path in the brain config, or the folder given to aidemd-mcp view --kanban.",
	"board-folder-missing":
		"The board is the folder named after the project's kanban tag inside the kanban folder. Check the instructions file's `Kanban project tag:` line, or create the project's board folder.",
	"no-kanban-tag":
		"The tag comes from the instructions file's `Kanban project tag:` line, which the agent reports at session start. Add the line and start a new session.",
	"board-read-failed": "The board is read again on every new event and page load.",
} as const satisfies Record<BoardUnavailable["reason"], string>;

export default boardHints;
