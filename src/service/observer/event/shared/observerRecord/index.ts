import isClosedRecord from "@/service/observer/event/shared/isClosedRecord/index.js";

/**
 * The shape of `observer.json`: `src/observer` writes the file in this shape
 * when it starts, and `record` reads it with `parse`. The address is
 * loopback-only on purpose, so a posted event can never leave the machine.
 * `version` is the running observer's AIDE package version. `port` is the port
 * the observer bound; a record written by an older observer has none, so
 * readers take the port from `address` then (brief commitment #98).
 */
export type ObserverRecord = {
	address: string;
	token: string;
	pid: number;
	version: string;
	port?: number;
};

const KEYS = ["address", "token", "pid", "version", "port"] as const;
const LOOPBACK_ADDRESS = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;

/**
 * Checks a parsed JSON value against the `observer.json` shape. Returns a new
 * object with the keys in shape order, omitting `port` when it is absent, or
 * null when the value does not fit: not an object, a key outside the shape, a
 * non-loopback address, an empty token or version, a pid below 1, or a port
 * outside 1 to 65 535. It never throws.
 */
export function parse(value: unknown): ObserverRecord | null {
	if (!isClosedRecord(value, KEYS)) return null;
	const { address, token, pid, version, port } = value;

	if (typeof address !== "string" || !LOOPBACK_ADDRESS.test(address)) return null;
	if (typeof token !== "string" || token.length < 1) return null;
	if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return null;
	if (typeof version !== "string" || version.length < 1) return null;

	if (port === undefined) return { address, token, pid, version };
	if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
		return null;
	}
	return { address, token, pid, version, port };
}
