import { useState } from "react";
import type { Theme } from "@/observer/page/types/index.js";
import pickInitialTheme from "./pickInitialTheme/index.js";

const STORAGE_KEY = "aide-observer-theme";

/** Reads the stored choice, or null when none is stored or the store is blocked. */
function readStoredTheme(): string | null {
	try {
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		// Storage can be blocked (private window, site data off); the preference decides.
		return null;
	}
}

/** Reads `prefers-color-scheme: light`; a browser without `matchMedia` counts as dark. */
function prefersLightScheme(): boolean {
	try {
		return window.matchMedia("(prefers-color-scheme: light)").matches;
	} catch {
		return false;
	}
}

/**
 * The page theme: the choice stored in localStorage when it holds `dark` or `light`, else the
 * visitor's `prefers-color-scheme` (light when it asks for light, otherwise dark), stored again on
 * every toggle. Every storage and media access is guarded so a blocked store never breaks the page.
 */
export default function useTheme(): { theme: Theme; toggle(): void } {
	const [theme, setTheme] = useState<Theme>(() =>
		pickInitialTheme({ stored: readStoredTheme(), prefersLight: prefersLightScheme() }),
	);
	return {
		theme,
		toggle: () => {
			const next: Theme = theme === "dark" ? "light" : "dark";
			setTheme(next);
			try {
				window.localStorage.setItem(STORAGE_KEY, next);
			} catch {
				// The choice still applies for this visit.
			}
		},
	};
}
