import type { GovernedField, GovernedKind } from "../types/index.js";

/**
 * The one list of governed values. Intent specs carry `alignment`; plans, todo
 * lists and briefs carry `status` with one shared lifecycle. Each entry names the
 * field, its allowed values and the starting value used when the field is absent
 * or invalid. No other module writes these lists out; they import this constant
 * or the types derived from it.
 */
export const GOVERNED_FIELDS = {
	"intent-spec": {
		field: "alignment",
		values: ["unreviewed", "aligned", "misaligned"],
		initial: "unreviewed",
	},
	plan: {
		field: "status",
		values: ["proposed", "approved", "completed", "abandoned"],
		initial: "proposed",
	},
	todo: {
		field: "status",
		values: ["proposed", "approved", "completed", "abandoned"],
		initial: "proposed",
	},
	brief: {
		field: "status",
		values: ["proposed", "approved", "completed", "abandoned"],
		initial: "proposed",
	},
} as const satisfies Record<
	GovernedKind,
	{ field: GovernedField; values: readonly string[]; initial: string }
>;

/** The key older intent specs used for alignment before it was renamed to `alignment`; read as alignment, moved to the new name on write. */
export const LEGACY_ALIGNMENT_KEY = "status";
