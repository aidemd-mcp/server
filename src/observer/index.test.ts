import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { connect, createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import create from "@/util/runtimePaths/create/index.js";
import createRoot from "@/util/runtimePaths/createRoot/index.js";
import listProjectFolders from "@/util/runtimePaths/listProjectFolders/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import touchPresence from "@/service/observer/event/touchPresence/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import findRunningObserver from "./findRunningObserver/index.js";
import startObserver from "./index.js";
import buildViewLink from "./buildViewLink/index.js";
import type { RunningObserver, StartResult } from "./types/index.js";

const observerVersion = vi.hoisted(() => ({ value: "1.0.0" }));
const pidGate = vi.hoisted(() => ({ fake: false, gone: false }));
const replayGate = vi.hoisted(() => ({ wait: (): Promise<void> => Promise.resolve() }));

vi.mock("@/util/isProcessRunning/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/util/isProcessRunning/index.js")>();
	return {
		// In-process observers share one pid; the fake lets a test decide when "the old process" has exited.
		default: (pid: number) => (pidGate.fake && pid === process.pid ? !pidGate.gone : original.default(pid)),
	};
});
const pageAssets = vi.hoisted(() => ({ folder: "" }));
const bindGate = vi.hoisted(() => ({ busy: new Set<number>() }));
vi.mock("./bindServer/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("./bindServer/index.js")>();
	return {
		// A port in the gate reads as busy without a real holder, so the walk is exercised on any machine.
		default: (input: Parameters<typeof original.default>[0]) =>
			bindGate.busy.has(input.port)
				? Promise.resolve({ kind: "failed" as const, reason: `Port ${input.port} is busy; stubbed.` })
				: original.default(input),
	};
});
vi.mock("./locatePageAssets/index.js", () => ({ default: () => pageAssets.folder }));
vi.mock("@/util/readPackageVersion/index.js", () => ({ default: () => observerVersion.value }));

vi.mock("@/service/observer/event/read/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/service/observer/event/read/index.js")>();
	return {
		default: async (input: Parameters<typeof original.default>[0]) => {
			await replayGate.wait();
			return original.default(input);
		},
	};
});

let projectRoot: string;
let appData: string;
const stops: (() => Promise<void>)[] = [];
const cleanups: (() => void)[] = [];

async function freePort(): Promise<number> {
	const probe = createServer();
	await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
	const { port } = probe.address() as AddressInfo;
	await new Promise<void>((done) => probe.close(() => done()));
	return port;
}

function urlOf({ observer }: { observer: RunningObserver }): string {
	return buildViewLink({ observer });
}

async function start({ port }: { port: number }): Promise<StartResult> {
	const result = await startObserver({ port });
	if ("stop" in result) stops.push(result.stop);
	return result;
}

function projectKeyOf(root: string): string {
	return resolve({ projectRoot: root }).projectKey;
}

async function readRecord(): Promise<unknown> {
	const { observerFile } = resolveRoot();
	return JSON.parse(await readFile(observerFile, "utf8"));
}

async function exists(file: string): Promise<boolean> {
	return stat(file).then(
		() => true,
		() => false,
	);
}

async function deadPid(): Promise<number> {
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	const pid = child.pid as number;
	await new Promise<void>((done) => child.once("exit", () => done()));
	return pid;
}

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-observer-project-"));
	appData = await mkdtemp(join(tmpdir(), "aide-observer-appdata-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	replayGate.wait = () => Promise.resolve();
	observerVersion.value = "1.0.0";
	pidGate.fake = false;
	pidGate.gone = false;
	bindGate.busy.clear();
	await Promise.all(stops.splice(0).map((stop) => stop()));
	vi.unstubAllEnvs();
	await rm(projectRoot, { recursive: true, force: true });
	await rm(appData, { recursive: true, force: true });
});

describe("startObserver lifecycle", () => {
	it("rejects a port that is not an integer from 1 to 65535", async () => {
		for (const port of [0, 65536, 1.5, Number.NaN]) {
			await expect(startObserver({ port })).rejects.toThrow(/port/i);
		}
	});

	it("returns the full url with a 64-hex token", async () => {
		const port = await freePort();
		const result = await start({ port });
		expect(result).toMatchObject({ outcome: "started" });
		if (result.outcome !== "started") return;
		expect(urlOf(result)).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port}/\\?token=[0-9a-f]{64}$`));
	});

	it("publishes observer.json with the address, the same token and this pid", async () => {
		const port = await freePort();
		const result = await start({ port });
		if (result.outcome !== "started") throw new Error("expected a start");
		const token = new URL(urlOf(result)).searchParams.get("token");
		expect(await readRecord()).toEqual({
			address: `http://127.0.0.1:${port}`,
			port,
			token,
			pid: process.pid,
			version: "1.0.0",
		});
	});

	it("answers a second start with kept: the same address and token, nothing bound, the first still serving", async () => {
		const port = await freePort();
		const first = await start({ port });
		if (first.outcome !== "started") throw new Error("expected a start");

		const spare = await freePort();
		const second = await start({ port: spare });
		expect(second).toEqual({ outcome: "kept", observer: first.observer });
		await expect(fetch(`http://127.0.0.1:${spare}/`)).rejects.toThrow();

		const response = await fetch(urlOf(first));
		expect(response.status).toBe(200);
	});

	it("lets findRunningObserver see the url while it runs and not after stop", async () => {
		const port = await freePort();
		const result = await start({ port });
		if (result.outcome !== "started") throw new Error("expected a start");

		const token = new URL(urlOf(result)).searchParams.get("token");
		expect(await findRunningObserver()).toEqual({
			address: `http://127.0.0.1:${port}`,
			port,
			token,
			pid: process.pid,
			version: "1.0.0",
		});
		await result.stop();
		expect(await findRunningObserver()).toBeNull();
	});

	it("keeps the record at the app-data root, never in a project folder or under a project root", async () => {
		const result = await start({ port: await freePort() });
		if ("stop" in result) await result.stop();
		expect(await exists(join(resolveRoot().root, "observer.json"))).toBe(false);
		await start({ port: await freePort() });
		expect(await exists(join(resolveRoot().root, "observer.json"))).toBe(true);
		expect(await exists(join(resolve({ projectRoot }).folder, "observer.json"))).toBe(false);
		expect(await readdir(projectRoot)).toEqual([]);
	});

	it("reports the running observer to a start from another project and binds nothing", async () => {
		const first = await start({ port: await freePort() });
		if (first.outcome !== "started") throw new Error("expected a start");
		const otherRoot = await mkdtemp(join(tmpdir(), "aide-observer-other-"));
		cleanups.push(() => void rm(otherRoot, { recursive: true, force: true }));

		const spare = await freePort();
		const second = await startObserver({ port: spare, brainOverride: { projectRoot: otherRoot, brainPath: otherRoot } });
		expect(second).toEqual({ outcome: "kept", observer: first.observer });
		await expect(fetch(`http://127.0.0.1:${spare}/`)).rejects.toThrow();
	});

	it("adds no SIGINT or SIGTERM listener", async () => {
		const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
		const result = await start({ port: await freePort() });
		expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
		if ("stop" in result) await result.stop();
		expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
	});

	it("treats a record whose pid is not alive as stale and replaces it", async () => {
		const { observerFile } = await createRoot();
		const pid = await deadPid();
		await writeFile(observerFile, JSON.stringify({ address: "http://127.0.0.1:1", token: "old", pid }));

		const result = await start({ port: await freePort() });
		expect(result).toMatchObject({ outcome: "started" });
		expect(await readRecord()).toMatchObject({ pid: process.pid, version: "1.0.0" });
	});

	it("treats a record with a live pid but an unanswering address as stale and replaces it", async () => {
		const { observerFile } = await createRoot();
		const dead = await freePort();
		await writeFile(
			observerFile,
			JSON.stringify({ address: `http://127.0.0.1:${dead}`, token: "old", pid: process.pid, version: "1.0.0" }),
		);

		const result = await start({ port: await freePort() });
		expect(result).toMatchObject({ outcome: "started" });
		expect(await readRecord()).not.toMatchObject({ token: "old" });
	});

	it("binds the next list port when the preferred port is held, and the record names it", async () => {
		const holder = createServer();
		await new Promise<void>((done) => holder.listen(0, "127.0.0.1", done));
		const { port: held } = holder.address() as AddressInfo;
		// Only the last list port can bind (a real observer may hold the head), so the result does not depend on the machine.
		const target = protocol.ports[protocol.ports.length - 1]!;
		bindGate.busy = new Set(protocol.ports.filter((port) => port !== target));
		try {
			const result = await start({ port: held });
			expect(result).toMatchObject({ outcome: "started", observer: { port: target, address: `http://127.0.0.1:${target}` } });
			expect(await readRecord()).toMatchObject({ port: target, address: `http://127.0.0.1:${target}` });
		} finally {
			await new Promise<void>((done) => holder.close(() => done()));
		}
	});

	it("binds a free preferred port outside the list and never touches the list", async () => {
		bindGate.busy = new Set(protocol.ports);
		const port = await freePort();
		const result = await start({ port });
		expect(result).toMatchObject({ outcome: "started", observer: { port } });
		expect(await readRecord()).toMatchObject({ port });
	});

	it("returns not-started naming every port tried, writes no record and binds nothing", async () => {
		const holder = createServer();
		await new Promise<void>((done) => holder.listen(0, "127.0.0.1", done));
		const { port } = holder.address() as AddressInfo;
		bindGate.busy = new Set(protocol.ports);
		try {
			const result = await start({ port });
			expect(result).toMatchObject({ outcome: "not-started" });
			if (result.outcome !== "not-started") throw new Error("expected a reason");
			expect(result.reason).toMatch(/^No port could be bound: /);
			for (const tried of [port, ...protocol.ports]) expect(result.reason).toContain(String(tried));
			const { observerFile } = resolveRoot();
			expect(await exists(observerFile)).toBe(false);
		} finally {
			await new Promise<void>((done) => holder.close(() => done()));
		}
	});

	it("removes observer.json on stop", async () => {
		const result = await start({ port: await freePort() });
		if (result.outcome !== "started") throw new Error("expected a start");
		const { observerFile } = resolveRoot();
		expect(await exists(observerFile)).toBe(true);
		await result.stop();
		expect(await exists(observerFile)).toBe(false);
	});

	it("leaves a record rewritten with another token in place on stop", async () => {
		const port = await freePort();
		const result = await start({ port });
		if (result.outcome !== "started") throw new Error("expected a start");
		const { observerFile } = resolveRoot();
		const replacement = { address: `http://127.0.0.1:${port}`, port, token: "someone-else", pid: process.pid, version: "1.0.0" };
		await writeFile(observerFile, JSON.stringify(replacement));

		await result.stop();
		expect(await readRecord()).toEqual(replacement);
	});

	it("creates nothing under the project folder", async () => {
		const result = await start({ port: await freePort() });
		if ("stop" in result) await result.stop();
		expect(await readdir(projectRoot)).toEqual([]);
	});

	it("keeps one token across stop and start on the same app-data root, in observer.json and the token file", async () => {
		const first = await start({ port: await freePort() });
		if (first.outcome !== "started") throw new Error("expected a start");
		await first.stop();

		const second = await start({ port: await freePort() });
		if (second.outcome !== "started") throw new Error("expected a start");
		expect(second.observer.token).toBe(first.observer.token);
		expect(await readRecord()).toMatchObject({ token: first.observer.token });
		expect((await readFile(join(resolveRoot().root, "observer-token"), "utf8")).trim()).toBe(first.observer.token);
	});

	it("does not list the observer-token file as a project", async () => {
		const result = await start({ port: await freePort() });
		if (result.outcome !== "started") throw new Error("expected a start");
		await create({ projectRoot });
		expect(await exists(join(resolveRoot().root, "observer-token"))).toBe(true);
		expect((await listProjectFolders()).map((folder) => folder.projectKey)).toEqual([projectKeyOf(projectRoot)]);
	});
});

type Frame ={ name: string; data: Record<string, unknown> };
type Reply = { status: number; headers: IncomingHttpHeaders; body: string };
type Running = { port: number; url: string; token: string };
type Stream = {
	waitFor: (input: { name: string; seq?: number; ms: number }) => Promise<Frame>;
	quiet: (input: { ms: number }) => Promise<Frame[]>;
	close: () => void;
};

const TOKEN_HEADER = "x-aide-observer-token";
const seenHeaders: IncomingHttpHeaders[] = [];

function makeEvent({
	sessionId,
	seq,
	text,
	pid = process.pid,
}: {
	sessionId: string;
	seq: number;
	text?: string;
	pid?: number;
}): Record<string, unknown> {
	return {
		v: 1,
		ts: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
		sessionId,
		seq,
		pid,
		kind: "prompt",
		text: text ?? `event ${seq}`,
	};
}

function makeStartedEvent({
	sessionId,
	root,
	brainPath,
	kanbanTag,
	pid = process.pid,
	ts = new Date(Date.UTC(2026, 0, 1, 0, 0, 1)).toISOString(),
}: {
	sessionId: string;
	root?: string;
	brainPath?: string;
	kanbanTag?: string;
	pid?: number;
	ts?: string;
}): Record<string, unknown> {
	return {
		v: 1,
		ts,
		sessionId,
		seq: 1,
		pid,
		kind: "session_started",
		...(root !== undefined && { projectRoot: root }),
		...(brainPath !== undefined && { brainPath }),
		...(kanbanTag !== undefined && { kanbanTag }),
	};
}

async function seedSession({
	sessionId,
	events,
	root = projectRoot,
}: {
	sessionId: string;
	events: Record<string, unknown>[];
	root?: string;
}): Promise<void> {
	await create({ projectRoot: root });
	const body = events.map((event) => JSON.stringify(event)).join("\n");
	await writeFile(resolveEventLog({ projectRoot: root, sessionId }), `${body}\n`);
}

/** Writes the ended mark of a session the way the end-session tool does, so the recording side judges it ended. */
async function markEnded({ sessionId, root = projectRoot }: { sessionId: string; root?: string }): Promise<void> {
	const { projectKey } = await create({ projectRoot: root });
	await writeEndedMark({ projectKey, mark: { v: 1, sessionId, endedAt: new Date().toISOString(), endedBy: "user" } });
}

/** Records a Stop hook linked to a session, so the recording side judges it waiting. The ping fails silently when no observer runs. */
async function markWaiting({ sessionId, root = projectRoot }: { sessionId: string; root?: string }): Promise<void> {
	const outcome = await touchPresence({
		projectRoot: root,
		claudeSessionId: `claude-${sessionId}`,
		hookEvent: "Stop",
		state: "waiting",
		at: new Date().toISOString(),
		linkSessionId: sessionId,
		endsObserverSession: false,
	});
	if (!outcome.written) throw new Error(`presence was not written: ${outcome.detail ?? "unchanged"}`);
}

function tokenOf(url: string): string {
	return new URL(url).searchParams.get("token") as string;
}

async function startRunning(): Promise<Running> {
	const port = await freePort();
	const result = await start({ port });
	if (result.outcome !== "started") throw new Error("expected a start");
	return { port, url: urlOf(result), token: tokenOf(urlOf(result)) };
}

function send({
	port,
	method = "GET",
	path,
	host,
	token,
	headers = {},
	body,
}: {
	port: number;
	method?: string;
	path: string;
	host?: string;
	token?: string;
	headers?: Record<string, string>;
	body?: string;
}): Promise<Reply> {
	return new Promise((done, fail) => {
		const merged: Record<string, string> = { Host: host ?? `127.0.0.1:${port}`, ...headers };
		if (token) merged[TOKEN_HEADER] = token;
		const request = httpRequest({ host: "127.0.0.1", port, method, path, headers: merged }, (response) => {
			const chunks: Buffer[] = [];
			response.on("data", (chunk: Buffer) => chunks.push(chunk));
			response.on("error", fail);
			response.on("end", () => {
				seenHeaders.push(response.headers);
				done({
					status: response.statusCode as number,
					headers: response.headers,
					body: Buffer.concat(chunks).toString("utf8"),
				});
			});
		});
		request.on("error", fail);
		request.end(body);
	});
}

function postEvent({
	port,
	token,
	event,
	projectKey = projectKeyOf(projectRoot),
}: {
	port: number;
	token: string;
	event: Record<string, unknown>;
	projectKey?: string;
}): Promise<Reply> {
	return send({
		port,
		method: "POST",
		path: "/api/events",
		token,
		headers: { "Content-Type": "application/json", [protocol.projectHeader]: projectKey },
		body: JSON.stringify(event),
	});
}

function json(reply: Reply): { data?: Record<string, unknown>; error?: { message: string } } {
	return JSON.parse(reply.body);
}

function sleep(ms: number): Promise<void> {
	return new Promise((done) => setTimeout(done, ms));
}

async function openStream({ port, token, project }: { port: number; token: string; project?: string }): Promise<Stream> {
	const controller = new AbortController();
	const filter = project === undefined ? "" : `&project=${encodeURIComponent(project)}`;
	const response = await fetch(`http://127.0.0.1:${port}/api/stream?token=${token}${filter}`, {
		signal: controller.signal,
	});
	if (response.status !== 200) throw new Error(`stream answered ${response.status}`);
	const frames: Frame[] = [];
	let cursor = 0;

	void (async () => {
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
				buffer += decoder.decode(chunk, { stream: true });
				let end = buffer.indexOf("\n\n");
				while (end >= 0) {
					const raw = buffer.slice(0, end);
					buffer = buffer.slice(end + 2);
					end = buffer.indexOf("\n\n");
					const name = /^event: (.*)$/m.exec(raw)?.[1];
					const data = /^data: (.*)$/m.exec(raw)?.[1];
					if (name && data) frames.push({ name, data: JSON.parse(data) });
				}
			}
		} catch {
			// The test closed the stream (abort) or the server ended it.
		}
	})();

	const close = () => controller.abort();
	cleanups.push(close);

	return {
		close,
		async waitFor({ name, seq, ms }) {
			const deadline = Date.now() + ms;
			for (;;) {
				while (cursor < frames.length) {
					const frame = frames[cursor++];
					if (frame.name === name && (seq === undefined || (frame.data.event as { seq: number } | undefined)?.seq === seq)) return frame;
				}
				if (Date.now() >= deadline) throw new Error(`no ${name} frame within ${ms} ms`);
				await sleep(5);
			}
		},
		async quiet({ ms }) {
			await sleep(ms);
			const rest = frames.slice(cursor);
			cursor = frames.length;
			return rest;
		},
	};
}

function sessionsOf(frame: Frame): { sessionId: string; events: { seq: number }[] }[] {
	return frame.data.sessions as { sessionId: string; events: { seq: number }[] }[];
}

describe("startObserver live stream", () => {
	it("pushes a posted event to an open stream promptly and exactly once", async () => {
		const sessionId = "20260101T000000Z-live";
		await seedSession({ sessionId, events: [makeEvent({ sessionId, seq: 1 }), makeEvent({ sessionId, seq: 2 })] });
		const { port, token } = await startRunning();

		const stream = await openStream({ port, token, project: projectKeyOf(projectRoot) });
		const snapshot = await stream.waitFor({ name: "snapshot", ms: 2000 });
		expect(sessionsOf(snapshot).map((s) => s.events.map((e) => e.seq))).toEqual([[1, 2]]);
		await stream.waitFor({ name: "status", ms: 5000 });

		const event = makeEvent({ sessionId, seq: 3 });
		const posted = await postEvent({ port, token, event });
		expect(posted.status).toBe(200);
		expect(json(posted).data).toEqual({ outcome: "accepted" });
		const live = await stream.waitFor({ name: "aide-event", seq: 3, ms: 500 });
		expect(live.data.projectKey).toBe(projectKeyOf(projectRoot));
		expect((live.data.event as { sessionId: string }).sessionId).toBe(sessionId);
		await stream.waitFor({ name: "status", ms: 5000 });

		const again = await postEvent({ port, token, event });
		expect(again.status).toBe(200);
		expect(json(again).data).toEqual({ outcome: "duplicate" });
		const extra = await stream.quiet({ ms: 300 });
		expect(extra.filter((frame) => frame.name === "aide-event")).toEqual([]);
	});

	it("delivers the same event to two open streams", async () => {
		const { port, token } = await startRunning();
		const first = await openStream({ port, token });
		const second = await openStream({ port, token });
		await first.waitFor({ name: "snapshot", ms: 2000 });
		await second.waitFor({ name: "snapshot", ms: 2000 });

		await postEvent({ port, token, event: makeEvent({ sessionId: "20260101T000000Z-two", seq: 1 }) });
		const [a, b] = await Promise.all([
			first.waitFor({ name: "aide-event", seq: 1, ms: 500 }),
			second.waitFor({ name: "aide-event", seq: 1, ms: 500 }),
		]);
		expect(a.data).toEqual(b.data);
	});

	it("shows an event posted during replay exactly once and keeps streaming afterwards", async () => {
		const sessionId = "20260101T000000Z-replay";
		await seedSession({ sessionId, events: [makeEvent({ sessionId, seq: 1 }), makeEvent({ sessionId, seq: 2 })] });
		let openGate: () => void = () => undefined;
		replayGate.wait = () => new Promise<void>((done) => (openGate = done));

		const port = await freePort();
		const starting = startObserver({ port });
		try {
			const { observerFile } = resolveRoot();
			let token = "";
			for (let tries = 0; tries < 200 && !token; tries++) {
				token = await readFile(observerFile, "utf8").then(
					(text) => (JSON.parse(text) as { token: string }).token,
					() => "",
				);
				if (!token) await sleep(25);
			}
			expect(token).not.toBe("");

			let ready: boolean | undefined;
			for (let tries = 0; tries < 200 && ready !== false; tries++) {
				const index = await send({ port, path: "/", token }).catch(() => null);
				ready = index?.status === 200 ? (json(index).data?.ready as boolean) : undefined;
				if (ready === undefined) await sleep(25);
			}
			expect(ready).toBe(false);

			const key = projectKeyOf(projectRoot);
			expect((await send({ port, path: `/api/projects/${key}/status`, token })).status).toBe(503);
			expect((await send({ port, path: "/api/stream", token })).status).toBe(503);

			const duplicate = await postEvent({ port, token, event: makeEvent({ sessionId, seq: 2 }) });
			const fresh = await postEvent({ port, token, event: makeEvent({ sessionId, seq: 3 }) });
			expect(duplicate.status).toBe(202);
			expect(json(duplicate).data).toEqual({ outcome: "held" });
			expect(fresh.status).toBe(202);
			expect(json(fresh).data).toEqual({ outcome: "held" });

			openGate();
			const result = await starting;
			if ("stop" in result) stops.push(result.stop);

			const stream = await openStream({ port, token, project: key });
			const snapshot = await stream.waitFor({ name: "snapshot", ms: 2000 });
			expect(sessionsOf(snapshot).map((s) => s.events.map((e) => e.seq))).toEqual([[1, 2, 3]]);

			const events = await send({ port, path: `/api/projects/${key}/events`, token });
			const listed = json(events).data as { sessions: { events: { seq: number }[] }[] };
			expect(listed.sessions.map((s) => s.events.map((e) => e.seq))).toEqual([[1, 2, 3]]);

			await stream.waitFor({ name: "status", ms: 5000 });
			await postEvent({ port, token, event: makeEvent({ sessionId, seq: 4 }) });
			await stream.waitFor({ name: "aide-event", seq: 4, ms: 500 });
		} finally {
			openGate();
			const result = await starting.catch(() => null);
			if (result && "stop" in result && !stops.includes(result.stop)) stops.push(result.stop);
		}
	});
});

describe("startObserver project intake", () => {
	it("replays two projects and files a post for each under its own key", async () => {
		const otherRoot = await mkdtemp(join(tmpdir(), "aide-observer-other-"));
		try {
			const first = "20260101T000000Z-first";
			const second = "20260101T000000Z-second";
			await seedSession({ sessionId: first, events: [makeEvent({ sessionId: first, seq: 1 })] });
			await create({ projectRoot: otherRoot });
			await writeFile(
				resolveEventLog({ projectRoot: otherRoot, sessionId: second }),
				`${JSON.stringify(makeEvent({ sessionId: second, seq: 1 }))}
`,
			);
			const { port, token } = await startRunning();
			const stream = await openStream({ port, token });
			const snapshot = await stream.waitFor({ name: "snapshot", ms: 2000 });
			expect(sessionsOf(snapshot).map((s) => s.sessionId).sort()).toEqual([first, second]);

			const mine = await postEvent({ port, token, event: makeEvent({ sessionId: first, seq: 2 }) });
			const theirs = await postEvent({
				port,
				token,
				event: makeEvent({ sessionId: second, seq: 2 }),
				projectKey: projectKeyOf(otherRoot),
			});
			expect(json(mine).data).toEqual({ outcome: "accepted" });
			expect(json(theirs).data).toEqual({ outcome: "accepted" });

			const keyed = new Map<string, string>();
			for (const seq of [2, 2]) {
				const frame = await stream.waitFor({ name: "aide-event", seq, ms: 500 });
				keyed.set((frame.data.event as { sessionId: string }).sessionId, frame.data.projectKey as string);
			}
			expect(Object.fromEntries(keyed)).toEqual({
				[first]: projectKeyOf(projectRoot),
				[second]: projectKeyOf(otherRoot),
			});
		} finally {
			await rm(otherRoot, { recursive: true, force: true });
		}
	});

	it("refuses a missing, bad or mismatching project key and never streams the event", async () => {
		const { port, token } = await startRunning();
		const stream = await openStream({ port, token });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		const sessionId = "20260101T000000Z-keyed";
		const body = JSON.stringify(makeEvent({ sessionId, seq: 1 }));
		const asJson = { "Content-Type": "application/json" };

		const missing = await send({ port, method: "POST", path: "/api/events", token, headers: asJson, body });
		const bad = await send({
			port,
			method: "POST",
			path: "/api/events",
			token,
			headers: { ...asJson, [protocol.projectHeader]: "../x" },
			body,
		});
		expect([missing.status, bad.status]).toEqual([400, 400]);

		expect((await postEvent({ port, token, event: makeEvent({ sessionId, seq: 1 }) })).status).toBe(200);
		const mismatch = await postEvent({
			port,
			token,
			event: makeEvent({ sessionId, seq: 2 }),
			projectKey: "intruder-abcdef",
		});
		expect(mismatch.status).toBe(409);

		await stream.waitFor({ name: "aide-event", seq: 1, ms: 500 });
		const rest = await stream.quiet({ ms: 300 });
		expect(rest.filter((frame) => frame.name === "aide-event")).toEqual([]);
	});
});

describe("startObserver security", () => {
	let sandbox: string;
	let outsideDir: string;

	beforeEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
		sandbox = await mkdtemp(join(tmpdir(), "aide-observer-sandbox-"));
		projectRoot = join(sandbox, "project");
		outsideDir = join(sandbox, "outside");
		await mkdir(projectRoot);
		await mkdir(outsideDir);
		await writeFile(join(sandbox, "outside.txt"), "outside");
		await writeFile(join(outsideDir, "secret.txt"), "secret");
		await writeFile(join(projectRoot, "ok.txt"), "inside");
		seenHeaders.length = 0;
	});

	afterEach(async () => {
		const leaked = seenHeaders.flatMap((headers) => Object.keys(headers)).filter((name) => name.startsWith("access-control-"));
		await rm(sandbox, { recursive: true, force: true });
		expect(leaked).toEqual([]);
	});

	it.each(["evil.example", "attacker.test"])("refuses Host %s with 403", async (name) => {
		const { port, token } = await startRunning();
		expect((await send({ port, path: "/", token, host: `${name}:${port}` })).status).toBe(403);
	});

	it("refuses a Host with another port and accepts localhost:<port>", async () => {
		const { port, token } = await startRunning();
		expect((await send({ port, path: "/", token, host: `127.0.0.1:${port + 1}` })).status).toBe(403);
		expect((await send({ port, path: "/", token, host: `localhost:${port}` })).status).toBe(200);
	});

	it("requires the token on reads, the stream and posts", async () => {
		const { port, url, token } = await startRunning();
		const targets = [
			{ method: "GET", path: "/" },
				{ method: "GET", path: `/api/projects/${projectKeyOf(projectRoot)}/status` },
				{ method: "GET", path: `/api/projects/${projectKeyOf(projectRoot)}/sessions` },
			{ method: "GET", path: "/api/stream" },
			{ method: "POST", path: "/api/events" },
		];
		for (const { method, path } of targets) {
			const headers = { "Content-Type": "application/json" };
			const body = method === "POST" ? "{}" : undefined;
			expect((await send({ port, method, path, headers, body })).status).toBe(401);
			expect((await send({ port, method, path, headers, body, token: "0".repeat(64) })).status).toBe(401);
		}
		expect((await send({ port, path: `/?token=${tokenOf(url)}` })).status).toBe(200);
		expect((await send({ port, path: "/", token, headers: { Origin: "http://evil.example" } })).status).toBe(403);
	});

	it("keeps file reads inside the project root, through every escape", async () => {
		await seedSession({ sessionId: "20260101T000000Z-root", events: [makeStartedEvent({ sessionId: "20260101T000000Z-root", root: projectRoot })] });
		const { port, token } = await startRunning();
		const filePath = `/api/projects/${projectKeyOf(projectRoot)}/file`;
		await symlink(outsideDir, join(projectRoot, "link"), "junction");
		const absolute = process.platform === "win32" ? "C:\\Windows\\win.ini" : "/etc/passwd";
		const requests = [
			"../outside.txt",
			"..%2F..%2Foutside.txt",
			"%2e%2e/outside.txt",
			encodeURIComponent(join(outsideDir, "secret.txt")),
			encodeURIComponent(absolute),
			encodeURIComponent("\\\\localhost\\c$\\x"),
			"link/secret.txt",
		];
		for (const requested of requests) {
			const reply = await send({ port, path: `${filePath}?path=${requested}`, token });
			expect(reply.status, requested).toBe(403);
		}
		const valid = await send({ port, path: `${filePath}?path=ok.txt`, token });
		expect(valid.status).toBe(200);
		expect(json(valid).data).toEqual({ path: "ok.txt", text: "inside" });
	});

	it("refuses OPTIONS with 405 and no CORS header", async () => {
		const { port, token } = await startRunning();
		const reply = await send({ port, method: "OPTIONS", path: "/api/events", token });
		expect(reply.status).toBe(405);
		expect(Object.keys(reply.headers).filter((name) => name.startsWith("access-control-"))).toEqual([]);
	});

	it("rejects malformed posts and then accepts a valid one that reaches the stream", async () => {
		const { port, token } = await startRunning();
		const stream = await openStream({ port, token });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		const jsonType = { "Content-Type": "application/json", [protocol.projectHeader]: projectKeyOf(projectRoot) };
		const post = (headers: Record<string, string>, body: string) =>
			send({ port, method: "POST", path: "/api/events", token, headers: { [protocol.projectHeader]: projectKeyOf(projectRoot), ...headers }, body });

		expect((await post(jsonType, "{not json")).status).toBe(400);
		expect((await post(jsonType, JSON.stringify({ kind: "prompt" }))).status).toBe(400);
		expect((await post({ "Content-Type": "text/plain" }, "{}")).status).toBe(415);
		expect((await post(jsonType, "x".repeat(1_048_577))).status).toBe(413);

		const sessionId = "20260101T000000Z-after";
		const accepted = await postEvent({ port, token, event: makeEvent({ sessionId, seq: 1 }) });
		expect(accepted.status).toBe(200);
		await stream.waitFor({ name: "aide-event", seq: 1, ms: 500 });
	});

	it("does not let a stalled stream client delay a normal one", async () => {
		const { port, token } = await startRunning();
		const slow = connect({ host: "127.0.0.1", port });
		cleanups.push(() => slow.destroy());
		slow.on("error", () => undefined);
		await new Promise<void>((done) => slow.once("connect", () => done()));
		slow.write(`GET /api/stream?token=${token} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n\r\n`);
		slow.pause();
		await sleep(150);

		const stream = await openStream({ port, token });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		const sessionId = "20260101T000000Z-slow";
		const text = "a".repeat(64 * 1024);

		for (let seq = 1; seq <= 40; seq++) {
			const startedAt = Date.now();
			const posted = await postEvent({ port, token, event: makeEvent({ sessionId, seq, text }) });
			expect(posted.status).toBe(200);
			await stream.waitFor({ name: "aide-event", seq, ms: 500 });
			expect(Date.now() - startedAt).toBeLessThan(500);
			// Let the coalesced status rebuild finish so its CPU work never overlaps the next post.
			await stream.waitFor({ name: "status", ms: 5000 });
		}
		expect((await send({ port, path: "/", token })).status).toBe(200);
	}, 30_000);
});

describe("startObserver project views", () => {
	let sandbox: string;
	let rootA: string;
	let rootB: string;
	let rootC: string;
	let keyA: string;
	let keyB: string;
	let keyC: string;
	const sessionA = "20260101T000000Z-aaaaaa";
	const sessionB = "20260101T000000Z-bbbbbb";
	const sessionC = "20260101T000000Z-cccccc";

	beforeEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
		sandbox = await mkdtemp(join(tmpdir(), "aide-observer-views-"));
		rootA = join(sandbox, "alpha");
		rootB = join(sandbox, "beta");
		rootC = join(sandbox, "gamma");
		for (const root of [rootA, rootB, rootC]) await mkdir(root);
		projectRoot = rootA;
		[keyA, keyB, keyC] = [rootA, rootB, rootC].map(projectKeyOf);

		await mkdir(join(rootA, "alphamod"));
		await mkdir(join(rootB, "betamod"));
		const spec = (scope: string) =>
			`---\nscope: ${scope}\nalignment: unreviewed\ndescription: d\nintent: i\noutcomes:\n  desired:\n    - x\n  undesired:\n    - y\n---\n`;
		await writeFile(join(rootA, "alphamod", ".aide"), spec("alphamod"));
		await writeFile(join(rootB, "betamod", ".aide"), spec("betamod"));
		await writeFile(join(rootA, "ok.txt"), "alpha file");
		await writeFile(join(rootB, "secret.txt"), "beta secret");
		await symlink(rootB, join(rootA, "link-to-b"), "junction");

		await seedSession({
			sessionId: sessionA,
			root: rootA,
			events: [makeStartedEvent({ sessionId: sessionA, root: rootA }), makeEvent({ sessionId: sessionA, seq: 2 })],
		});
		await seedSession({
			sessionId: sessionB,
			root: rootB,
			events: [makeStartedEvent({ sessionId: sessionB, root: rootB }), makeEvent({ sessionId: sessionB, seq: 2 })],
		});
		await seedSession({
			sessionId: sessionC,
			root: rootC,
			events: [makeStartedEvent({ sessionId: sessionC }), makeEvent({ sessionId: sessionC, seq: 2 })],
		});
	});

	afterEach(async () => {
		await rm(sandbox, { recursive: true, force: true });
	});

	type Status = { state: string; projectKey: string; detail?: string; status?: { sessions: { sessionId: string }[]; tree: unknown } };

	async function readStatus({ port, token, key }: { port: number; token: string; key: string }): Promise<Status> {
		const reply = await send({ port, path: `/api/projects/${key}/status`, token });
		expect(reply.status).toBe(200);
		return json(reply).data as unknown as Status;
	}

	it("builds each project's status from its own root, tree and sessions only", async () => {
		const { port, token } = await startRunning();

		const a = await readStatus({ port, token, key: keyA });
		const b = await readStatus({ port, token, key: keyB });

		expect(a.state).toBe("ready");
		expect(a.status?.sessions.map((s) => s.sessionId)).toEqual([sessionA]);
		expect(JSON.stringify(a.status?.tree)).toContain("alphamod");
		expect(JSON.stringify(a.status?.tree)).not.toContain("betamod");
		expect(b.status?.sessions.map((s) => s.sessionId)).toEqual([sessionB]);
		expect(JSON.stringify(b.status?.tree)).toContain("betamod");
		expect(JSON.stringify(b.status?.tree)).not.toContain("alphamod");

		const events = await send({ port, path: `/api/projects/${keyA}/events`, token });
		const listed = json(events).data as { sessions: { sessionId: string }[] };
		expect(listed.sessions.map((s) => s.sessionId)).toEqual([sessionA]);
	});

	it("refuses a path that climbs into a neighbouring project, however written, and keeps serving", async () => {
		const { port, token } = await startRunning();
		const filePath = `/api/projects/${keyA}/file`;
		const requests = [
			"../beta/secret.txt",
			"..%2Fbeta%2Fsecret.txt",
			"%2e%2e/beta/secret.txt",
			encodeURIComponent(join(rootB, "secret.txt")),
			"link-to-b/secret.txt",
		];

		for (const requested of requests) {
			const reply = await send({ port, path: `${filePath}?path=${requested}`, token });
			expect(reply.status, requested).toBe(403);
		}
		const valid = await send({ port, path: `${filePath}?path=ok.txt`, token });
		expect(valid.status).toBe(200);
		expect(json(valid).data).toEqual({ path: "ok.txt", text: "alpha file" });
		const other = await send({ port, path: `/api/projects/${keyB}/file?path=secret.txt`, token });
		expect(json(other).data).toEqual({ path: "secret.txt", text: "beta secret" });
	});

	it("serves a project with no reported root as no-project-root: file 409, task 404, sessions and events still served", async () => {
		const { port, token } = await startRunning();

		const status = await readStatus({ port, token, key: keyC });
		expect(status).toMatchObject({ state: "no-project-root", projectKey: keyC });
		expect(status.detail).toContain("reported its project root");
		expect((await send({ port, path: `/api/projects/${keyC}/file?path=ok.txt`, token })).status).toBe(409);
		expect((await send({ port, path: `/api/projects/${keyC}/task/anything`, token })).status).toBe(404);

		const sessions = await send({ port, path: `/api/projects/${keyC}/sessions`, token });
		expect((json(sessions).data as { sessions: { sessionId: string }[] }).sessions.map((s) => s.sessionId)).toEqual([sessionC]);
		const events = await send({ port, path: `/api/projects/${keyC}/events`, token });
		expect((json(events).data as { sessions: { events: unknown[] }[] }).sessions[0].events).toHaveLength(2);
	});

	it("answers 404 for an unknown or invalid project key on every route", async () => {
		const { port, token } = await startRunning();

		for (const key of ["nobody-abcdef", "..%2Fx", "plain"]) {
			for (const suffix of ["status", "events", "sessions", "file?path=ok.txt", "task/x"]) {
				const reply = await send({ port, path: `/api/projects/${key}/${suffix}`, token });
				expect(reply.status, `${key}/${suffix}`).toBe(404);
			}
			expect((await send({ port, method: "DELETE", path: `/api/projects/${key}/sessions/${sessionA}`, token })).status).toBe(404);
			expect((await send({ port, path: `/api/stream?project=${key}`, token })).status).toBe(404);
		}
	});

	it("applies the --brain override to its own project only", async () => {
		const brains = await mkdtemp(join(tmpdir(), "aide-observer-brains-"));
		try {
			const note = async ({ brain, slug }: { brain: string; slug: string }) => {
				await mkdir(join(brain, "kanban", "board", "todo"), { recursive: true });
				await writeFile(join(brain, "kanban", "board", "todo", `${slug}.md`), `# ${slug}\n`);
			};
			const [brainA, brainB, override] = ["a", "b", "override"].map((name) => join(brains, name));
			await note({ brain: brainA, slug: "a-own" });
			await note({ brain: brainB, slug: "b-own" });
			await note({ brain: override, slug: "override-task" });
			// Newer than the session_started the beforeEach seeded, so these two are each project's newest.
			const LATER = "2026-06-01T00:00:00.000Z";
			const sessionA2 = "20260101T000001Z-a2a2a2";
			const sessionB2 = "20260101T000001Z-b2b2b2";
			await seedSession({ sessionId: sessionA2, root: rootA, events: [makeStartedEvent({ sessionId: sessionA2, root: rootA, brainPath: brainA, kanbanTag: "board", ts: LATER })] });
			await seedSession({ sessionId: sessionB2, root: rootB, events: [makeStartedEvent({ sessionId: sessionB2, root: rootB, brainPath: brainB, kanbanTag: "board", ts: LATER })] });

			const port = await freePort();
			const result = await startObserver({ port, brainOverride: { projectRoot: rootA, brainPath: override } });
			if ("stop" in result) stops.push(result.stop);
			if (result.outcome !== "started") throw new Error("expected a start");
			const token = tokenOf(urlOf(result));
			const task = (key: string, slug: string) => send({ port, path: `/api/projects/${key}/task/${slug}`, token });

			expect((await task(keyA, "override-task")).status).toBe(200);
			expect((await task(keyA, "a-own")).status).toBe(404);
			expect((await task(keyB, "b-own")).status).toBe(200);
			expect((await task(keyB, "override-task")).status).toBe(404);
		} finally {
			await rm(brains, { recursive: true, force: true });
		}
	});

	it("archives a past session of its own project, lists it as archived, restores it, and deletes it only once archived", async () => {
		const past = "20250101T000000Z-dddddd";
		const pid = await deadPid();
		const events = [makeStartedEvent({ sessionId: past, root: rootA, pid }), makeEvent({ sessionId: past, seq: 2, pid })];
		await seedSession({ sessionId: past, root: rootA, events });
		await markEnded({ sessionId: past, root: rootA });
		await seedSession({ sessionId: past, root: rootB, events: events.map((event) => ({ ...event, projectRoot: rootB })) });
		const { port, token } = await startRunning();
		const heldIds = async () => {
			const listed = await send({ port, path: `/api/projects/${keyA}/sessions`, token });
			return (json(listed).data as { sessions: { sessionId: string }[] }).sessions.map((s) => s.sessionId);
		};
		const archivedIds = async () => {
			const listed = await send({ port, path: `/api/projects/${keyA}/archive`, token });
			expect(listed.status).toBe(200);
			return (json(listed).data as { sessions: { sessionId: string }[] }).sessions.map((s) => s.sessionId);
		};

		// Permanent delete refuses a session that has not been archived.
		expect((await send({ port, method: "DELETE", path: `/api/projects/${keyA}/archive/${past}`, token })).status).toBe(404);
		expect(await exists(resolveEventLog({ projectRoot: rootA, sessionId: past }))).toBe(true);

		const archived = await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${past}/archive`, token });
		expect(archived.status).toBe(200);
		expect(await exists(resolveEventLog({ projectRoot: rootA, sessionId: past }))).toBe(false);
		expect(await exists(resolveEventLog({ projectRoot: rootB, sessionId: past }))).toBe(true);
		expect(await exists(resolveEventLog({ projectRoot: rootA, sessionId: sessionA }))).toBe(true);
		expect(await heldIds()).toEqual([sessionA]);
		expect(await archivedIds()).toEqual([past]);

		const restored = await send({ port, method: "POST", path: `/api/projects/${keyA}/archive/${past}/restore`, token });
		expect(restored.status).toBe(200);
		expect(await exists(resolveEventLog({ projectRoot: rootA, sessionId: past }))).toBe(true);
		expect((await heldIds()).sort()).toEqual([past, sessionA].sort());
		expect(await archivedIds()).toEqual([]);

		expect((await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${past}/archive`, token })).status).toBe(200);
		const deleted = await send({ port, method: "DELETE", path: `/api/projects/${keyA}/archive/${past}`, token });
		expect(deleted.status).toBe(200);
		expect(await archivedIds()).toEqual([]);
		expect(await heldIds()).toEqual([sessionA]);
		expect(await exists(resolveEventLog({ projectRoot: rootB, sessionId: past }))).toBe(true);
	});

	it("refuses to archive a live session and leaves its log", async () => {
		const { port, token } = await startRunning();

		const reply = await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${sessionA}/archive`, token });

		expect(reply.status).toBe(409);
		expect(await exists(resolveEventLog({ projectRoot: rootA, sessionId: sessionA }))).toBe(true);
	});

	it("lists working, waiting and ended sessions from the files on disk, on the sessions and archive routes alike", async () => {
		const waiting = "20260101T000000Z-wwwwww";
		const ended = "20260101T000000Z-eeeeee";
		await seedSession({ sessionId: waiting, root: rootA, events: [makeStartedEvent({ sessionId: waiting, root: rootA })] });
		await seedSession({ sessionId: ended, root: rootA, events: [makeStartedEvent({ sessionId: ended, root: rootA })] });
		await markWaiting({ sessionId: waiting, root: rootA });
		await markEnded({ sessionId: ended, root: rootA });
		const { port, token } = await startRunning();

		const listed = await send({ port, path: `/api/projects/${keyA}/sessions`, token });
		const states = Object.fromEntries(
			(json(listed).data as { sessions: { sessionId: string; liveness: { state: string; endedBy?: string } }[] }).sessions.map((s) => [
				s.sessionId,
				s.liveness,
			]),
		);

		expect(states[sessionA]).toMatchObject({ state: "working" });
		expect(states[waiting]).toMatchObject({ state: "waiting" });
		expect(states[ended]).toMatchObject({ state: "ended", endedBy: "user" });

		expect((await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${ended}/archive`, token })).status).toBe(200);
		const archive = await send({ port, path: `/api/projects/${keyA}/archive`, token });
		const archived = (json(archive).data as { sessions: { sessionId: string; liveness: { state: string } }[] }).sessions;
		expect(archived.map((s) => [s.sessionId, s.liveness.state])).toEqual([[ended, "ended"]]);

		const refused = await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${waiting}/archive`, token });
		expect(refused.status).toBe(409);
		expect(json(refused)).toEqual({ error: { message: `Session ${waiting} has not ended; only an ended session can be archived.` } });
	});

	it("hands status an archived session's events for resuming and never lists that session as a session of the project", async () => {
		const past = "20250101T000000Z-aaaaaa";
		await seedSession({ sessionId: past, root: rootA, events: [makeStartedEvent({ sessionId: past, root: rootA })] });
		await markEnded({ sessionId: past, root: rootA });
		const { port, token } = await startRunning();
		expect((await send({ port, method: "POST", path: `/api/projects/${keyA}/sessions/${past}/archive`, token })).status).toBe(200);

		const status = await send({ port, path: `/api/projects/${keyA}/status`, token });

		expect(status.status).toBe(200);
		const sessions = (json(status).data as { status: { sessions: { sessionId: string }[] } }).status.sessions.map((s) => s.sessionId);
		expect(sessions).not.toContain(past);
		expect(sessions).toContain(sessionA);
	});

	type Listing = { projectKey: string; projectRoot: string | null; lastEventAt: string | null; sessions: { sessionId: string; liveness: { state: "working" | "waiting" | "ended"; endedBy?: string } }[] };

	async function readProjects({ port, token }: { port: number; token: string }): Promise<Listing[]> {
		const reply = await send({ port, path: "/api/projects", token });
		expect(reply.status).toBe(200);
		return (json(reply).data as { projects: Listing[] }).projects;
	}

	it("lists every project on the home route, including one whose sessions never reported a root", async () => {
		const ended = "20260101T000000Z-eeeeee";
		await seedSession({
			sessionId: ended,
			root: rootA,
			events: [makeStartedEvent({ sessionId: ended, root: rootA, pid: await deadPid() })],
		});
		await markEnded({ sessionId: ended, root: rootA });
		const { port, token } = await startRunning();

		const projects = await readProjects({ port, token });

		expect(projects.map((p) => p.projectKey).sort()).toEqual([keyA, keyB, keyC].sort());
		const byKey = Object.fromEntries(projects.map((p) => [p.projectKey, p]));
		expect(byKey[keyA].projectRoot).toBe(rootA);
		expect(byKey[keyB].projectRoot).toBe(rootB);
		expect(byKey[keyC].projectRoot).toBeNull();
		expect(byKey[keyC].sessions.map((s) => s.sessionId)).toEqual([sessionC]);
		expect(byKey[keyC].lastEventAt).not.toBeNull();
		expect(Object.fromEntries(byKey[keyA].sessions.map((s) => [s.sessionId, s.liveness.state]))).toEqual({ [ended]: "ended", [sessionA]: "working" });
	});

	it("adds a project first posted after start to the list and to a projects frame; filtered clients get no projects frame", async () => {
		const { port, token } = await startRunning();
		const home = await openStream({ port, token });
		const filtered = await openStream({ port, token, project: keyA });
		await home.waitFor({ name: "snapshot", ms: 2000 });
		await filtered.waitFor({ name: "snapshot", ms: 2000 });
		const rootD = join(sandbox, "delta");
		await mkdir(rootD);
		const keyD = projectKeyOf(rootD);
		const sessionD = "20260101T000000Z-dddddd";

		const posted = await postEvent({ port, token, event: makeStartedEvent({ sessionId: sessionD, root: rootD }), projectKey: keyD });
		expect(posted.status).toBe(200);

		const frame = await home.waitFor({ name: "projects", ms: 2000 });
		const listed = (frame.data.projects as Listing[]).find((p) => p.projectKey === keyD);
		expect(listed).toMatchObject({ projectRoot: rootD, sessions: [{ sessionId: sessionD, liveness: { state: "working" } }] });
		expect((await readProjects({ port, token })).map((p) => p.projectKey)).toContain(keyD);
		const seen = await filtered.quiet({ ms: 300 });
		expect(seen.filter((f) => f.name === "projects")).toEqual([]);
	});

	it("answers the session page as HTML during and after the replay", async () => {
		let openGate: () => void = () => undefined;
		replayGate.wait = () => new Promise<void>((done) => (openGate = done));
		const port = await freePort();
		const starting = startObserver({ port });
		try {
			const { observerFile } = resolveRoot();
			let token = "";
			for (let tries = 0; tries < 200 && !token; tries++) {
				token = await readFile(observerFile, "utf8").then(
					(text) => (JSON.parse(text) as { token: string }).token,
					() => "",
				);
				if (!token) await sleep(25);
			}
			expect(token).not.toBe("");

			const during = await send({ port, path: `/p/${keyA}/s/${sessionA}`, token });
			expect(during.status).toBe(200);
			expect(during.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(during.body).toContain("<!doctype html>");

			openGate();
			const result = await starting;
			if ("stop" in result) stops.push(result.stop);
			const after = await send({ port, path: `/p/${keyA}/s/${sessionA}`, token });
			expect(after.status).toBe(200);
			expect(after.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(after.body).toContain("<!doctype html>");
		} finally {
			openGate();
			const result = await starting.catch(() => null);
			if (result && "stop" in result && !stops.includes(result.stop)) stops.push(result.stop);
		}
	});

	it("answers 404 on the retired /projects/<key>/sessions/<id> session path", async () => {
		const { port, token } = await startRunning();

		const old = await send({ port, path: `/projects/${keyA}/sessions/${sessionA}`, token });
		expect(old.status).toBe(404);
	});

	it("serves the page end to end: tokenless shell and assets, the home route by Accept, and the token still on the JSON", async () => {
		const assets = await mkdtemp(join(tmpdir(), "aide-observer-assets-"));
		pageAssets.folder = assets;
		await writeFile(join(assets, "page.js"), "export {};");
		await writeFile(join(assets, "page.css"), "body{}");
		try {
			const { port, token } = await startRunning();

			const page = await send({ port, path: `/p/${keyA}/s/${sessionA}`, token });
			expect(page.status).toBe(200);
			expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(page.headers["content-security-policy"]).toContain("script-src 'self'");
			expect(page.body).toContain('src="/assets/page.js"');
			expect(page.body).not.toContain(token);

			const asset = await send({ port, path: "/assets/page.js" });
			expect(asset.status).toBe(200);
			expect(asset.headers["content-type"]).toBe("text/javascript; charset=utf-8");
			expect(asset.body).toBe("export {};");

			const stylesheet = await send({ port, path: "/assets/page.css" });
			expect(stylesheet.status).toBe(200);

			const tokenlessShell = await send({ port, path: `/p/${keyA}/s/${sessionA}` });
			expect(tokenlessShell.status).toBe(200);
			expect((await send({ port, path: "/assets/other.js" })).status).toBe(404);

			expect((await send({ port, path: "/" })).status).toBe(401);
			const tokenlessHome = await send({ port, path: "/", headers: { Accept: "text/html" } });
			expect(tokenlessHome.status).toBe(200);
			expect(tokenlessHome.body).not.toContain(token);

			const badHost = await send({ port, path: "/assets/page.js", host: `evil.example:${port}` });
			expect(badHost.status).toBe(403);
			const badOrigin = await send({ port, path: `/p/${keyA}/s/${sessionA}`, headers: { Origin: "http://evil.example" } });
			expect(badOrigin.status).toBe(403);

			const home = await send({ port, path: "/", token, headers: { Accept: "text/html" } });
			expect(home.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(home.headers.vary).toBe("Accept");
			expect(home.body).toContain("<!doctype html>");

			const probe = await send({ port, path: "/", token });
			expect(probe.headers["content-type"]).toBe("application/json; charset=utf-8");
			expect(probe.headers.vary).toBe("Accept");
			expect(json(probe).data).toMatchObject({ observer: "aide-observer" });
		} finally {
			pageAssets.folder = "";
			await rm(assets, { recursive: true, force: true });
		}
	});

	it("sends a project-filtered stream client only its project's frames; an unfiltered client gets every project's", async () => {
		const { port, token } = await startRunning();
		const filtered = await openStream({ port, token, project: keyA });
		const everything = await openStream({ port, token });
		const snapshot = await filtered.waitFor({ name: "snapshot", ms: 2000 });
		expect(sessionsOf(snapshot).map((s) => s.sessionId)).toEqual([sessionA]);
		await everything.waitFor({ name: "snapshot", ms: 2000 });
		const initial = await filtered.waitFor({ name: "status", ms: 5000 });
		expect(initial.data.projectKey).toBe(keyA);

		await postEvent({ port, token, event: makeEvent({ sessionId: sessionB, seq: 3 }), projectKey: keyB });
		await postEvent({ port, token, event: makeEvent({ sessionId: sessionA, seq: 3 }), projectKey: keyA });
		await postEvent({ port, token, event: makeEvent({ sessionId: sessionC, seq: 3 }), projectKey: keyC });

		const seen = new Set<string>();
		for (let index = 0; index < 3; index++) {
			const frame = await everything.waitFor({ name: "aide-event", ms: 1000 });
			seen.add(frame.data.projectKey as string);
		}
		expect([...seen].sort()).toEqual([keyA, keyB, keyC].sort());

		const own = await filtered.waitFor({ name: "aide-event", ms: 1000 });
		expect(own.data.projectKey).toBe(keyA);
		expect((own.data.event as { sessionId: string }).sessionId).toBe(sessionA);
		await filtered.waitFor({ name: "status", ms: 5000 });
		const rest = await filtered.quiet({ ms: 400 });
		expect(rest.filter((frame) => frame.name === "aide-event")).toEqual([]);
		for (const frame of rest.filter((candidate) => candidate.name === "status")) expect(frame.data.projectKey).toBe(keyA);
	});
});

describe("startObserver shutdown request", () => {
	async function shutdownRequest({ url, version, headers = {} }: { url: string; version: string; headers?: Record<string, string> }): Promise<Response> {
		const { origin, searchParams } = new URL(url);
		return fetch(`${origin}${protocol.shutdownRoute}`, {
			method: "POST",
			headers: { "content-type": "application/json", [protocol.tokenHeader]: searchParams.get("token") as string, ...headers },
			body: JSON.stringify({ version }),
		});
	}

	async function startServing(): Promise<Extract<StartResult, { outcome: "started" }>> {
		const result = await start({ port: await freePort() });
		if (result.outcome !== "started") throw new Error("expected a start");
		return result;
	}

	it("answers GET / with the running version", async () => {
		observerVersion.value = "3.4.5";
		const result = await startServing();

		const body = (await (await fetch(urlOf(result))).json()) as { data: { version: string } };
		expect(body.data.version).toBe("3.4.5");
	});

	it("stops for a strictly newer caller: 202, the server closes, the record is removed and stopped resolves", async () => {
		observerVersion.value = "1.0.0";
		const result = await startServing();
		const { observerFile } = resolveRoot();
		expect(await exists(observerFile)).toBe(true);

		const reply = await shutdownRequest({ url: urlOf(result), version: "1.0.1" });
		expect(reply.status).toBe(202);
		expect(await reply.json()).toEqual({ data: { stopping: true, version: "1.0.0" } });

		await result.stopped;
		expect(await exists(observerFile)).toBe(false);
		await expect(fetch(urlOf(result))).rejects.toThrow();
	});

	it("leaves a record that names another observer in place when it stops", async () => {
		observerVersion.value = "1.0.0";
		const result = await startServing();
		const { observerFile } = resolveRoot();
		const replacement = { address: new URL(urlOf(result)).origin, token: "someone-else", pid: process.pid, version: "1.0.0" };
		await writeFile(observerFile, JSON.stringify(replacement));

		await shutdownRequest({ url: urlOf(result), version: "2.0.0" });
		await result.stopped;

		expect(await readRecord()).toEqual(replacement);
	});

	it.each(["1.0.0", "0.9.9", "unknown"])("keeps serving and keeps the record when the caller version is %s", async (caller) => {
		observerVersion.value = "1.0.0";
		const result = await startServing();

		const reply = await shutdownRequest({ url: urlOf(result), version: caller });
		expect(reply.status).toBe(409);
		expect((await fetch(urlOf(result))).status).toBe(200);
		expect(await exists(resolveRoot().observerFile)).toBe(true);
	});

	it("refuses a request carrying an Origin header with 403 and keeps serving", async () => {
		const result = await startServing();
		const { origin } = new URL(urlOf(result));

		const reply = await shutdownRequest({ url: urlOf(result), version: "9.9.9", headers: { origin } });
		expect(reply.status).toBe(403);
		expect((await fetch(urlOf(result))).status).toBe(200);
	});

	it("honours a shutdown request that lands while the history is still replaying", async () => {
		let release: () => void = () => undefined;
		replayGate.wait = () => new Promise<void>((done) => (release = done));
		observerVersion.value = "1.0.0";
		const port = await freePort();
		const starting = startObserver({ port });
		await vi.waitFor(async () => expect(await exists(resolveRoot().observerFile)).toBe(true));
		const record = (await readRecord()) as { address: string; token: string };

		const reply = await shutdownRequest({ url: `${record.address}/?token=${record.token}`, version: "1.0.1" });
		expect(reply.status).toBe(202);
		release();
		const result = await starting;
		if (result.outcome !== "started") throw new Error("expected a start");

		await result.stopped;
		expect(await exists(resolveRoot().observerFile)).toBe(false);
	});
});

describe("startObserver single instance and version replace", () => {
	/** Waits until the record names a version other than `previous`, i.e. the replacement has bound and published. */
	async function waitForReplacementRecord({ previous }: { previous: string }): Promise<{ address: string; token: string; version: string }> {
		let record = { address: "", token: "", version: previous };
		for (let tries = 0; tries < 200 && record.version === previous; tries++) {
			record = await readFile(resolveRoot().observerFile, "utf8").then(
				(text) => JSON.parse(text) as { address: string; token: string; version: string },
				() => ({ address: "", token: "", version: previous }),
			);
			if (record.version === previous) await sleep(25);
		}
		return record;
	}

	it("replaces an older running observer on the same port, loses no event and shows each once", async () => {
		const sessionId = "20260101T000000Z-replace";
		await seedSession({ sessionId, events: [makeEvent({ sessionId, seq: 1 }), makeEvent({ sessionId, seq: 2 })] });
		observerVersion.value = "1.0.0";
		const port = await freePort();
		const older = await start({ port });
		if (older.outcome !== "started") throw new Error("expected a start");
		// The old observer's "process" counts as exited once it has stopped.
		pidGate.fake = true;
		void older.stopped.then(() => {
			pidGate.gone = true;
		});

		observerVersion.value = "1.0.1";
		let openGate: () => void = () => undefined;
		replayGate.wait = () => new Promise<void>((done) => (openGate = done));
		const starting = startObserver({ port });
		try {
			const record = await waitForReplacementRecord({ previous: older.observer.version });
			expect(record.address).toBe(older.observer.address);
			pidGate.gone = false;
			await older.stopped;

			const posted = await postEvent({ port, token: record.token, event: makeEvent({ sessionId, seq: 3 }) });
			expect(json(posted).data).toEqual({ outcome: "held" });
			openGate();
			const newer = await starting;
			if (newer.outcome !== "started") throw new Error("expected a start");
			stops.push(newer.stop);
			expect(newer.observer).toMatchObject({ address: older.observer.address, version: "1.0.1" });
			// One token per user (brief #54): the replacement keeps it, so open pages stay valid.
			expect(newer.observer.token).toBe(older.observer.token);

			const events = await send({ port, path: `/api/projects/${projectKeyOf(projectRoot)}/events`, token: newer.observer.token });
			const listed = json(events).data as { sessions: { events: { seq: number }[] }[] };
			expect(listed.sessions.map((s) => s.events.map((e) => e.seq))).toEqual([[1, 2, 3]]);
		} finally {
			openGate();
			const result = await starting.catch(() => null);
			if (result && "stop" in result && !stops.includes(result.stop)) stops.push(result.stop);
		}
	});

	it("binds the replaced observer's port, not the given one, when the old port is free again", async () => {
		const oldPort = await freePort();
		const older = await start({ port: oldPort });
		if (older.outcome !== "started") throw new Error("expected a start");
		pidGate.fake = true;
		void older.stopped.then(() => {
			pidGate.gone = true;
		});

		observerVersion.value = "1.0.1";
		const newer = await start({ port: await freePort() });
		pidGate.gone = false;
		expect(newer).toMatchObject({ outcome: "started", observer: { port: oldPort, address: older.observer.address } });
		expect(await readRecord()).toMatchObject({ port: oldPort, version: "1.0.1" });
	});

	it("walks the list when the replaced observer's port is taken after it exits", async () => {
		const oldPort = await freePort();
		const older = await start({ port: oldPort });
		if (older.outcome !== "started") throw new Error("expected a start");
		const target = protocol.ports[protocol.ports.length - 2]!;
		pidGate.fake = true;
		void older.stopped.then(() => {
			// Another program takes the old port, and only one list port is free.
			bindGate.busy = new Set([oldPort, ...protocol.ports.filter((port) => port !== target)]);
			pidGate.gone = true;
		});

		observerVersion.value = "1.0.1";
		const newer = await start({ port: await freePort() });
		pidGate.gone = false;
		expect(newer).toMatchObject({ outcome: "started", observer: { port: target } });
		expect(await readRecord()).toMatchObject({ port: target });
	});

	it("keeps a newer running observer when an older one starts, and it keeps serving", async () => {
		observerVersion.value = "2.0.0";
		const first = await start({ port: await freePort() });
		if (first.outcome !== "started") throw new Error("expected a start");

		observerVersion.value = "1.0.0";
		const second = await start({ port: await freePort() });
		expect(second).toEqual({ outcome: "kept", observer: first.observer });
		expect((await fetch(urlOf(first))).status).toBe(200);
		expect(await readRecord()).toMatchObject({ token: first.observer.token, version: "2.0.0" });
	});

	it("reports stuck with the older observer when it answers the shutdown but its process does not exit, and kills nothing", async () => {
		observerVersion.value = "1.0.0";
		const first = await start({ port: await freePort() });
		if (first.outcome !== "started") throw new Error("expected a start");
		pidGate.fake = true;

		observerVersion.value = "1.0.1";
		const second = await start({ port: await freePort() });
		expect(second).toEqual({ outcome: "stuck", observer: first.observer });
		if (second.outcome !== "stuck") return;
		expect(second.observer.version).toBe("1.0.0");
		expect(() => process.kill(second.observer.pid, 0)).not.toThrow();
	}, 15_000);

	it("writes nothing under any project root across a replace", async () => {
		const port = await freePort();
		const older = await start({ port });
		if (older.outcome !== "started") throw new Error("expected a start");
		pidGate.fake = true;
		void older.stopped.then(() => {
			pidGate.gone = true;
		});
		observerVersion.value = "1.0.1";
		const newer = await start({ port });
		pidGate.gone = false;
		expect(newer.outcome).toBe("started");
		expect(await readdir(projectRoot)).toEqual([]);
	});
});

describe("startObserver presence ping", () => {
	function ping({
		port,
		token,
		claudeSessionId = "claude-ping-1",
		projectKey = projectKeyOf(projectRoot),
	}: {
		port: number;
		token?: string;
		claudeSessionId?: string;
		projectKey?: string;
	}): Promise<Reply> {
		return send({
			port,
			method: "POST",
			path: protocol.presenceRoute,
			token,
			headers: { "Content-Type": "application/json", [protocol.projectHeader]: projectKey },
			body: JSON.stringify({ claudeSessionId }),
		});
	}

	it("refuses a ping without the token or with a wrong one", async () => {
		const { port } = await startRunning();
		expect((await ping({ port })).status).toBe(401);
		expect((await ping({ port, token: "0".repeat(64) })).status).toBe(401);
	});

	it("answers 400 without or with a bad project header, 415 for another media type and 400 for an unknown body key", async () => {
		const { port, token } = await startRunning();
		const withHeaders = (headers: Record<string, string>, body: string) =>
			send({ port, method: "POST", path: protocol.presenceRoute, token, headers, body });
		const project = { [protocol.projectHeader]: projectKeyOf(projectRoot) };

		expect((await withHeaders({ "Content-Type": "application/json" }, JSON.stringify({ claudeSessionId: "c1" }))).status).toBe(400);
		expect((await ping({ port, token, projectKey: "../x" })).status).toBe(400);
		expect((await withHeaders({ "Content-Type": "text/plain", ...project }, "{}")).status).toBe(415);
		expect((await withHeaders({ "Content-Type": "application/json", ...project }, JSON.stringify({ claudeSessionId: "c1", state: "waiting" }))).status).toBe(400);
	});

	it("answers 202, writes no file and pushes a sessions frame and a status to a filtered stream client", async () => {
		const sessionId = "20260101T000000Z-presence";
		await seedSession({ sessionId, events: [makeStartedEvent({ sessionId, root: projectRoot })] });
		const { port, token } = await startRunning();
		const key = projectKeyOf(projectRoot);
		const stream = await openStream({ port, token, project: key });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		await stream.waitFor({ name: "status", ms: 5000 });
		await stream.quiet({ ms: 100 });

		const folder = resolve({ projectRoot }).folder;
		const before = await readdir(folder, { recursive: true });
		const reply = await ping({ port, token });
		expect(reply.status).toBe(202);
		expect(json(reply).data).toEqual({ outcome: "accepted" });

		const frame = await stream.waitFor({ name: "sessions", ms: 2000 });
		expect(frame.data.projectKey).toBe(key);
		expect((frame.data.sessions as { sessionId: string }[]).map((s) => s.sessionId)).toEqual([sessionId]);
		await stream.waitFor({ name: "status", ms: 5000 });
		expect(await readdir(folder, { recursive: true })).toEqual(before);
	});

	it("shows the session as waiting in the pushed frame once a Stop presence is on disk", async () => {
		const sessionId = "20260101T000000Z-waits";
		await seedSession({ sessionId, events: [makeStartedEvent({ sessionId, root: projectRoot })] });
		const { port, token } = await startRunning();
		const stream = await openStream({ port, token, project: projectKeyOf(projectRoot) });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		await stream.waitFor({ name: "status", ms: 5000 });

		await markWaiting({ sessionId });
		expect((await ping({ port, token, claudeSessionId: `claude-${sessionId}` })).status).toBe(202);

		let state = "";
		for (let tries = 0; tries < 20 && state !== "waiting"; tries++) {
			const frame = await stream.waitFor({ name: "sessions", ms: 2000 });
			state = (frame.data.sessions as { liveness: { state: string } }[])[0].liveness.state;
		}
		expect(state).toBe("waiting");
	});

	it("answers 202 for a project the store does not hold and pushes the project list to an unfiltered client", async () => {
		const { port, token } = await startRunning();
		const stream = await openStream({ port, token });
		await stream.waitFor({ name: "snapshot", ms: 2000 });
		await stream.quiet({ ms: 100 });

		expect((await ping({ port, token, projectKey: "project-ffffff" })).status).toBe(202);
		await stream.waitFor({ name: "projects", ms: 2000 });
	});

	it("answers 202 during replay and pushes nothing until the store is ready", async () => {
		let openGate: () => void = () => undefined;
		replayGate.wait = () => new Promise<void>((done) => (openGate = done));
		const port = await freePort();
		const starting = startObserver({ port });
		try {
			const { observerFile } = resolveRoot();
			let token = "";
			for (let tries = 0; tries < 200 && !token; tries++) {
				token = await readFile(observerFile, "utf8").then(
					(text) => (JSON.parse(text) as { token: string }).token,
					() => "",
				);
				if (!token) await sleep(25);
			}
			expect(token).not.toBe("");
			let ready: boolean | undefined;
			for (let tries = 0; tries < 200 && ready !== false; tries++) {
				const index = await send({ port, path: "/", token }).catch(() => null);
				ready = index?.status === 200 ? (json(index).data?.ready as boolean) : undefined;
				if (ready === undefined) await sleep(25);
			}
			expect(ready).toBe(false);

			const reply = await ping({ port, token });
			expect(reply.status).toBe(202);
			expect(json(reply).data).toEqual({ outcome: "accepted" });
		} finally {
			openGate();
			const result = await starting.catch(() => null);
			if (result && "stop" in result && !stops.includes(result.stop)) stops.push(result.stop);
		}
	});
});
