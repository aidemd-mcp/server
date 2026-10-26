/** Code is anything but AIDE files, docs and dot-files, so it works in any language. */
export default function isCodeFile(name: string): boolean {
	if (name.startsWith(".")) return false;
	if (name.endsWith(".aide")) return false;
	const lower = name.toLowerCase();
	if (lower.endsWith(".md") || lower.endsWith(".markdown")) return false;
	return true;
}
