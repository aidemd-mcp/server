/** The guard's verdict: let the request through, or refuse it with a status and a message. */
export type GuardResult =
	| { ok: true }
	| { ok: false; status: 401 | 403 | 405; message: string };
