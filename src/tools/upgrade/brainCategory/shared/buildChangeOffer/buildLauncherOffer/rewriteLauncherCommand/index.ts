import { isMap, isScalar, parseDocument } from "yaml";

/** A command that stays readable as a plain YAML scalar. */
const PLAIN_COMMAND = /^[A-Za-z0-9._/-]+$/;

/**
 * Rewrites `mcpServerConfig.command` inside a brain.aide frontmatter region from `before` to
 * `after` without reformatting anything else. Only a single-line scalar in a block mapping whose value equals
 * `before` qualifies (anything else returns `null` so the caller can hand the replacement to a
 * human). The new value is written plain when it is made of path-safe characters, otherwise
 * single-quoted with `'` doubled. Only the scalar's source range changes; indentation, any
 * trailing comment and the line ending are untouched. Pure.
 */
export default function rewriteLauncherCommand({
	frontmatter,
	before,
	after,
}: {
	frontmatter: string;
	before: string;
	after: string;
}): string | null {
	const doc = parseDocument(frontmatter);
	if (doc.errors.length > 0) return null;
	const server = doc.get("mcpServerConfig", true);
	if (!isMap(server) || server.flow) return null;
	const command = server.get("command", true);
	if (!isScalar(command) || command.value !== before || !command.range) return null;

	const [start, end] = command.range;
	if (frontmatter.slice(start, end).includes("\n")) return null;

	const rendered = PLAIN_COMMAND.test(after) ? after : `'${after.replaceAll("'", "''")}'`;
	return frontmatter.slice(0, start) + rendered + frontmatter.slice(end);
}
