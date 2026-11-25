import { describe, it, expect } from "vitest";
import type { EndSessionReply } from "@/tools/observer/endSession/types/index.js";
import formatReply from "./index.js";

describe("endSession formatReply", () => {
	it.each<[EndSessionReply, string]>([
		[{ outcome: "ended", id: "s1" }, "ended s1"],
		[{ outcome: "already-ended", id: "s1" }, "already ended s1"],
		[{ outcome: "own-session", id: "s1" }, "refused: s1 is this session"],
		[{ outcome: "unknown", id: "s1" }, "refused: no session s1 in this project"],
		[{ outcome: "invalid-id", detail: "Invalid session id" }, "refused: invalid session id"],
		[{ outcome: "failed", detail: "EACCES: permission denied" }, "not ended (EACCES: permission denied)"],
	])("replies exactly for %j", (reply, expected) => {
		expect(formatReply(reply)).toBe(expected);
	});
});
