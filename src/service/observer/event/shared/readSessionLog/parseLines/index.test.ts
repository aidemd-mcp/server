import { describe, it, expect } from "vitest";
import parseLines from "@/service/observer/event/shared/readSessionLog/parseLines/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const SESSION_ID = "20261122T090000000Z-aaaaaa";

function makeEvent(overrides: Record<string, unknown> = {}): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T09:00:00.000Z",
		sessionId: SESSION_ID,
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.0.0",
		...overrides,
	} as ObserverEvent;
}

function toLines(events: unknown[]): string {
	return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

describe("parseLines", () => {
	it("returns three valid lines in order", () => {
		const events = [makeEvent({ seq: 1 }), makeEvent({ seq: 2 }), makeEvent({ seq: 3 })];

		const result = parseLines({ content: toLines(events), sessionId: SESSION_ID });

		expect(result.events).toEqual(events);
		expect(result.skippedLines).toBe(0);
	});

	it("skips and counts a truncated JSON line, keeping the lines after it", () => {
		const first = makeEvent({ seq: 1 });
		const third = makeEvent({ seq: 3 });
		const content = [JSON.stringify(first), '{"v":1,"ts":"2026-11-22T0', JSON.stringify(third)].join("\n");

		const result = parseLines({ content, sessionId: SESSION_ID });

		expect(result.events).toEqual([first, third]);
		expect(result.skippedLines).toBe(1);
	});

	it("skips and counts an off-schema line and a line from another session", () => {
		const good = makeEvent({ seq: 1 });
		const offSchema = { ...makeEvent({ seq: 2 }), kind: "nope" };
		const foreign = makeEvent({ seq: 3, sessionId: "20261122T100000000Z-bbbbbb" });

		const result = parseLines({ content: toLines([good, offSchema, foreign]), sessionId: SESSION_ID });

		expect(result.events).toEqual([good]);
		expect(result.skippedLines).toBe(2);
	});

	it("ignores blank lines and a trailing newline without counting them", () => {
		const events = [makeEvent({ seq: 1 }), makeEvent({ seq: 2 })];
		const content = `\n${JSON.stringify(events[0])}\n   \n\t\n${JSON.stringify(events[1])}\n\n`;

		const result = parseLines({ content, sessionId: SESSION_ID });

		expect(result.events).toEqual(events);
		expect(result.skippedLines).toBe(0);
	});

	it("parses CRLF content", () => {
		const events = [makeEvent({ seq: 1 }), makeEvent({ seq: 2 })];
		const content = events.map((event) => JSON.stringify(event)).join("\r\n") + "\r\n";

		const result = parseLines({ content, sessionId: SESSION_ID });

		expect(result.events).toEqual(events);
		expect(result.skippedLines).toBe(0);
	});

	it("sorts lines written out of seq order", () => {
		const events = [makeEvent({ seq: 3 }), makeEvent({ seq: 1 }), makeEvent({ seq: 2 })];

		const result = parseLines({ content: toLines(events), sessionId: SESSION_ID });

		expect(result.events.map((event) => event.seq)).toEqual([1, 2, 3]);
	});

	it("returns a prompt text with newlines and quotes byte-identical", () => {
		const text = 'line one\nline "two"\r\nline \\three\\ and a \'quote\'';
		const prompt = makeEvent({ kind: "prompt", text, version: undefined });

		const result = parseLines({ content: toLines([prompt]), sessionId: SESSION_ID });

		expect(result.events).toHaveLength(1);
		const [event] = result.events;
		expect(event.kind === "prompt" && event.text).toBe(text);
	});

	it("returns nothing for empty content", () => {
		expect(parseLines({ content: "", sessionId: SESSION_ID })).toEqual({ events: [], skippedLines: 0 });
	});
});
