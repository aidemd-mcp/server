import type { TreeFileEntry } from "@/types/index.js";

/** A tree file entry of a module. */
export default function makeFile({
	kind,
	folder,
	file,
	status = "approved",
	done = 0,
	total = 0,
}: {
	kind: "plan" | "todo" | "brief";
	folder: string;
	file: string;
	status?: "proposed" | "approved" | "completed" | "abandoned" | "unset";
	done?: number;
	total?: number;
}): TreeFileEntry {
	return {
		kind,
		file,
		folder,
		read: { state: "present", status, awaitingApproval: status === "proposed", progress: { done, total, open: total - done }, steps: { done, total } },
	};
}
