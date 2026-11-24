import type { ModuleRow, TreeAlignment } from "@/observer/page/types/index.js";

/**
 * The alignment badge a module's node wears. A reported alignment is kept as is; a readable intent
 * spec with none reported is the spec's default and shows as unreviewed. A module with no intent
 * spec, or one the observer could not read, has no badge.
 */
export default function pickAlignment({ module }: { module: ModuleRow }): TreeAlignment | null {
	if (module.alignment !== null) return module.alignment;
	if (module.intentFile === null || module.malformed.includes(module.intentFile)) return null;
	return "unreviewed";
}
