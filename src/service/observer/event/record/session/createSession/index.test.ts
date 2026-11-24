import { describe, it, expect } from "vitest";
import createSession from "@/service/observer/event/record/session/createSession/index.js";

describe("createSession", () => {
	it("starts with this process's pid, a session id and no started event", () => {
		const session = createSession();
		expect(session.pid).toBe(process.pid);
		expect(session.sessionId).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{6}$/);
		expect(session.startedRecorded).toBe(false);
	});

	it("hands out seq 1, 2, 3 in order", () => {
		const session = createSession();
		expect([session.nextSeq(), session.nextSeq(), session.nextSeq()]).toEqual([1, 2, 3]);
	});

	it("runs queued writes in order", async () => {
		const session = createSession();
		const order: number[] = [];
		await Promise.all([
			session.enqueue(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				order.push(1);
			}),
			session.enqueue(async () => {
				order.push(2);
			}),
		]);
		expect(order).toEqual([1, 2]);
	});

	it("keeps the chain going after a rejected write", async () => {
		const session = createSession();
		const failed = session.enqueue(async () => {
			throw new Error("boom");
		});
		await expect(failed).rejects.toThrow("boom");
		await expect(session.enqueue(async () => "next")).resolves.toBe("next");
	});
});
