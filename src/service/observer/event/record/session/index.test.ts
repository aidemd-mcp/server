import { describe, it, expect, vi, beforeEach } from "vitest";

type GetSession = typeof import("@/service/observer/event/record/session/index.js").default;

let getSession: GetSession;

beforeEach(async () => {
	vi.resetModules();
	getSession = (await import("@/service/observer/event/record/session/index.js")).default;
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("getSession", () => {
	it("returns the same object on every call", () => {
		expect(getSession()).toBe(getSession());
	});

	it("sets the sessionId once and the pid from the process", () => {
		const first = getSession().sessionId;
		expect(getSession().sessionId).toBe(first);
		expect(getSession().pid).toBe(process.pid);
		expect(getSession().startedRecorded).toBe(false);
	});

	it("hands out seq 1, 2, 3", () => {
		const session = getSession();
		expect([session.nextSeq(), session.nextSeq(), session.nextSeq()]).toEqual([1, 2, 3]);
	});

	it("runs enqueued writes in enqueue order whatever their delays", async () => {
		const session = getSession();
		const order: number[] = [];
		const write = (n: number, delay: number) => async () => {
			await sleep(delay);
			order.push(n);
			return n;
		};

		const results = await Promise.all([
			session.enqueue(write(1, 60)),
			session.enqueue(write(2, 30)),
			session.enqueue(write(3, 0)),
		]);

		expect(order).toEqual([1, 2, 3]);
		expect(results).toEqual([1, 2, 3]);
	});

	it("keeps the chain alive after a rejected write", async () => {
		const session = getSession();
		const failing = session.enqueue(async () => {
			throw new Error("boom");
		});
		const following = session.enqueue(async () => "ran");

		await expect(failing).rejects.toThrow("boom");
		await expect(following).resolves.toBe("ran");
	});

	it("creates a new sessionId after the module is reset", async () => {
		const first = getSession().sessionId;
		vi.resetModules();
		const fresh = (await import("@/service/observer/event/record/session/index.js")).default;
		expect(fresh().sessionId).not.toBe(first);
	});
});
