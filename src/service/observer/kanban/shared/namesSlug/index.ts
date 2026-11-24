/** Escapes every regular-expression metacharacter so a slug is matched literally. */
function escapePattern(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `slug` occurs in `text` as a whole slug: bounded on both sides by the edge of the text
 * or a character outside `[A-Za-z0-9-]`, so `fix-login` is not found inside `fix-login-bug`.
 */
export default function namesSlug({ text, slug }: { text: string; slug: string }): boolean {
	if (slug === "") return false;
	return new RegExp(`(?<![A-Za-z0-9-])${escapePattern(slug)}(?![A-Za-z0-9-])`).test(text);
}
