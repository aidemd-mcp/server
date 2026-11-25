import { describe, expect, it } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import listPorts from "./index.js";

describe("listPorts", () => {
	it("returns the list as is when the preferred port is its head", () => {
		expect(listPorts({ preferred: protocol.ports[0]! })).toEqual([...protocol.ports]);
	});

	it("moves a preferred port that is on the list to the front, once", () => {
		const preferred = protocol.ports[4]!;
		const listed = listPorts({ preferred });
		expect(listed[0]).toBe(preferred);
		expect(listed).toHaveLength(protocol.ports.length);
		expect(listed.slice(1)).toEqual(protocol.ports.filter((port) => port !== preferred));
	});

	it("puts a preferred port outside the list ahead of the whole list", () => {
		expect(listPorts({ preferred: 30001 })).toEqual([30001, ...protocol.ports]);
	});
});
