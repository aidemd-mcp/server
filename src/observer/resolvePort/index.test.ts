import { describe, expect, it } from "vitest";
import resolvePort from "./index.js";

describe("resolvePort", () => {
	it("defaults to 24680 with no flag and no env", () => {
		expect(resolvePort({ env: {} })).toEqual({ ok: true, port: 24680, source: "default" });
	});

	it("takes the env value when set", () => {
		expect(resolvePort({ env: { AIDE_OBSERVER_PORT: "30001" } })).toEqual({
			ok: true,
			port: 30001,
			source: "env",
		});
	});

	it("lets the flag beat the env", () => {
		expect(resolvePort({ flagPort: 30002, env: { AIDE_OBSERVER_PORT: "30001" } })).toEqual({
			ok: true,
			port: 30002,
			source: "flag",
		});
	});

	it("lets a valid flag win even when the env value is invalid", () => {
		expect(resolvePort({ flagPort: 30002, env: { AIDE_OBSERVER_PORT: "abc" } })).toEqual({
			ok: true,
			port: 30002,
			source: "flag",
		});
	});

	it.each(["", "   "])("treats a blank env value (%j) as unset", (blank) => {
		expect(resolvePort({ env: { AIDE_OBSERVER_PORT: blank } })).toEqual({
			ok: true,
			port: 24680,
			source: "default",
		});
	});

	it.each(["abc", "0", "65536", "1.5", "-1", " 80 x"])(
		"refuses env value %j naming the value, with no fallback",
		(value) => {
			const choice = resolvePort({ env: { AIDE_OBSERVER_PORT: value } });
			expect(choice).toEqual({
				ok: false,
				reason: `AIDE_OBSERVER_PORT must be an integer from 1 to 65535; got "${value}".`,
			});
		},
	);

	it.each([70000, 0, -5, 1.5, Number.NaN])("refuses flag value %s naming --port", (flagPort) => {
		const choice = resolvePort({ flagPort, env: { AIDE_OBSERVER_PORT: "30001" } });
		expect(choice).toEqual({
			ok: false,
			reason: `--port must be an integer from 1 to 65535; got ${flagPort}.`,
		});
	});

	it("accepts the bounds 1 and 65535", () => {
		expect(resolvePort({ flagPort: 1, env: {} })).toMatchObject({ ok: true, port: 1 });
		expect(resolvePort({ flagPort: 65535, env: {} })).toMatchObject({ ok: true, port: 65535 });
	});
});
