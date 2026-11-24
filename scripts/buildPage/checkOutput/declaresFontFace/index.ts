/** True when css declares an @font-face rule whose font-family is the given family. */
export default function declaresFontFace({ css, family }: { css: string; family: string }): boolean {
	const rules = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
	const declaration = new RegExp(`font-family:\\s*(["']?)${family}\\1\\s*[;}]`);
	return rules.some((rule) => declaration.test(rule));
}
