import { z } from "zod";

/**
 * The shape of `observer.json`: `src/observer` writes the file in this shape
 * when it starts, and `record` reads it with this schema. The address is
 * loopback-only on purpose, so a posted event can never leave the machine.
 * `version` is the running observer's AIDE package version.
 */
export const schema = z
	.object({
		address: z.string().regex(/^http:\/\/127\.0\.0\.1:\d{1,5}$/),
		token: z.string().min(1),
		pid: z.number().int().min(1),
		version: z.string().min(1),
	})
	.strict();

export type ObserverRecord = z.infer<typeof schema>;
