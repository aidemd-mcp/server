import type { PortParse } from "../../types/index.js";

const DECIMAL_INTEGER = /^\d+$/;
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * The one port parse and range rule (brief commitments #39, #44): a decimal integer from 1 to
 * 65535. Every place that accepts a port (the `--port` flag, the environment override, the
 * observer's own start) calls this, so no copy of the range can drift. A refusal names the
 * source and `shown`, the value exactly as the caller wants it echoed.
 */
export default function parsePort({
	value,
	source,
	shown,
}: {
	value: string;
	source: string;
	shown: string;
}): PortParse {
	const port = DECIMAL_INTEGER.test(value) ? Number(value) : Number.NaN;
	if (Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT) return { ok: true, port };
	return { ok: false, reason: `${source} must be an integer from ${MIN_PORT} to ${MAX_PORT}; got ${shown}.` };
}
