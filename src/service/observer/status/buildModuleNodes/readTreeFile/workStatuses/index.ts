import type { WorkStatus } from "@/types/index.js";

/**
 * The work-status values a brief's `status` may carry. Used only to read a
 * brief's status, which scan does not surface (scan reads plans and todos only).
 * If scan later reads brief status, `readTreeFile` switches to it and this goes.
 */
const WORK_STATUSES = ["proposed", "approved", "completed", "abandoned"] as const satisfies readonly WorkStatus[];

/** Compile-time exhaustiveness: a status added to the governed list leaves a non-`never` here and breaks the build. */
type MissingWorkStatus = Exclude<WorkStatus, (typeof WORK_STATUSES)[number]>;
export type WorkStatusesAreExhaustive = [MissingWorkStatus] extends [never] ? true : never;

export default WORK_STATUSES;
