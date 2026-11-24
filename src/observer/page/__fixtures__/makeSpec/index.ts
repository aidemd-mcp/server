import type { TreeFileEntry } from "@/types/index.js";

/** A tree file entry for a module's intent spec. */
export default function makeSpec({ folder, file, alignment = "aligned" }: { folder: string; file: string; alignment?: "aligned" | "unreviewed" | "misaligned" | "unset" }): TreeFileEntry {
	return { kind: "intent", file, folder, read: { state: "present", alignment, description: "d", progress: { done: 0, total: 0, open: 0 } } };
}
