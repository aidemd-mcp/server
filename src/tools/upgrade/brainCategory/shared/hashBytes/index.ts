import { createHash } from "node:crypto";

/**
 * Returns the lowercase hex SHA-256 of `text` encoded as UTF-8, with no normalization of
 * any kind (line endings, trailing whitespace and case all change the hash). It is the
 * guard a brain-category preview hands out and an apply recomputes, so the agent never
 * computes a hash itself.
 */
export default function hashBytes(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}
