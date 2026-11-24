import protocol from "@/service/observer/event/shared/protocol/index.js";

const PROBE_TIMEOUT_MS = 1_000;
const UNKNOWN_VERSION = "unknown";

/**
 * Ask the observer at `address` whether it really is the observer: GET `/` with the recorded
 * token must answer 200 with the index marker within one second. This guards against a recorded
 * pid that the operating system has since given to an unrelated process. The answer carries the
 * version of the code actually running; a missing or empty version is `"unknown"`, which no
 * caller ever replaces. Any throw, timeout or other answer is null; it never throws.
 */
export default async function probeIndex({
	address,
	token,
}: {
	address: string;
	token: string;
}): Promise<{ version: string } | null> {
	try {
		const response = await fetch(`${address}/`, {
			headers: { [protocol.tokenHeader]: token },
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		if (response.status !== 200) return null;

		const body = (await response.json()) as { data?: { observer?: unknown; version?: unknown } } | null;
		if (body?.data?.observer !== protocol.indexMarker) return null;

		const version = body.data.version;
		return { version: typeof version === "string" && version !== "" ? version : UNKNOWN_VERSION };
	} catch {
		return null;
	}
}
