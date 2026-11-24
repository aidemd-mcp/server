import { randomBytes } from "node:crypto";

/**
 * Builds a session id that sorts chronologically as a plain string: the UTC
 * time of `now` as `YYYYMMDDTHHmmssSSSZ`, a dash, then 6 random lowercase hex
 * characters so two processes started in the same millisecond never share an id.
 * The result is one safe file-name segment, so it passes `resolveEventLog`.
 */
export default function createSessionId({ now }: { now: Date }): string {
	const stamp = now.toISOString().replace(/[-:.]/g, "");
	return `${stamp}-${randomBytes(3).toString("hex")}`;
}
