import { z } from "zod";

/**
 * The body of `POST /api/shutdown`: the caller's AIDE package version, the one thing the observer
 * needs to decide whether the caller is newer than itself. Strict, so an unknown key is rejected
 * like it is on an event post.
 */
export const schema = z.object({ version: z.string().min(1) }).strict();

export type ShutdownRequest = z.infer<typeof schema>;
