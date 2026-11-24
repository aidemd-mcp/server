import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { ApiResponse } from "@/observer/types/index.js";
import type { ApiResult } from "@/observer/page/types/index.js";

const UNREACHABLE = "The observer could not be reached.";

/** Reads the body as the observer's envelope; null when it is not JSON. */
async function readEnvelope<T>(res: Response): Promise<ApiResponse<T> | null> {
	try {
		return (await res.json()) as ApiResponse<T>;
	} catch {
		return null;
	}
}

/**
 * Calls one observer route with the link's token in the protocol's token header and folds the
 * `ApiResponse` envelope and the HTTP status into an `ApiResult`. Never throws: a network error
 * is status 0, a non-JSON or error-less failure carries the HTTP status, and the observer's
 * `error.message` and `details` come through untouched.
 */
export default async function requestJson<T>({
	path,
	token,
	method = "GET",
}: {
	path: string;
	token: string;
	method?: "GET" | "DELETE";
}): Promise<ApiResult<T>> {
	let res: Response;
	try {
		res = await fetch(path, { method, headers: { [protocol.tokenHeader]: token } });
	} catch {
		return { ok: false, status: 0, message: UNREACHABLE };
	}

	const envelope = await readEnvelope<T>(res);
	if (envelope?.error) {
		const { message, details } = envelope.error;
		return details === undefined
			? { ok: false, status: res.status, message }
			: { ok: false, status: res.status, message, details };
	}
	if (!res.ok || envelope === null || envelope.data === undefined) {
		return { ok: false, status: res.status, message: `The observer answered ${res.status} without data.` };
	}
	return { ok: true, data: envelope.data };
}
