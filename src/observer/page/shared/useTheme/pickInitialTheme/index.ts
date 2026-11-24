import type { Theme } from "@/observer/page/types/index.js";

/**
 * Chooses the theme on first load: the stored choice wins, else the visitor's
 * `prefers-color-scheme: light` gives light, else dark.
 */
export default function pickInitialTheme({ stored, prefersLight }: { stored: string | null; prefersLight: boolean }): Theme {
	if (stored === "dark" || stored === "light") return stored;
	return prefersLight ? "light" : "dark";
}
