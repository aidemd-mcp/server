import type { Status } from "@/types/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";

/** A status with an empty project and the given overrides. */
export default function makeStatus(overrides: Partial<Status> = {}): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: NOW.toISOString(),
		tree: [],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions: [],
		running: [],
		waiting: [],
		surfaced: null,
		rails: [],
		history: [],
		board: { state: "unavailable", reason: "no-kanban-field", detail: "", hint: "" },
		problems: [],
		...overrides,
	};
}
