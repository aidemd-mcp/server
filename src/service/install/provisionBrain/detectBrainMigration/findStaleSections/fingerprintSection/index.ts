import { createHash } from "node:crypto";

/**
 * Fingerprints a brain section's text so it can be recognised as a known
 * outdated template version without shipping the old prose. The text is
 * normalized first, so whitespace-only drift from editors and line-ending
 * conversion (CRLF, trailing spaces, edge blank lines) cannot hide a known
 * outdated version, while any wording, internal-blank-line or indentation
 * change still changes the fingerprint and keeps a customization from matching.
 *
 * Returns the lowercase hex SHA-256 of the normalized UTF-8 text.
 */
export default function fingerprintSection(text: string): string {
	const normalized = text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/, ""))
		.join("\n")
		.replace(/^\n+|\n+$/g, "");
	return createHash("sha256").update(normalized, "utf8").digest("hex");
}
