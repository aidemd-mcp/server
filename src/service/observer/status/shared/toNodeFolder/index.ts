/**
 * The node folder an AIDE file belongs to: its POSIX folder, `"."` for a file
 * at the project root and for a file directly inside `.aide/` (the root spec,
 * root plan, root todo and the session record live there). Pure.
 */
export default function toNodeFolder(relativeFilePath: string): string {
	const posix = relativeFilePath.replace(/\\/g, "/");
	const slash = posix.lastIndexOf("/");
	if (slash === -1) return ".";

	const folder = posix.slice(0, slash);
	return folder === ".aide" ? "." : folder;
}
