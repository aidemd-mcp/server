import { useContext } from "react";
import type { ThemeContextValue } from "@/observer/page/types/index.js";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";

/** The theme and toggle a screen hands its `ThemeButton`; throws when no `ThemeRoot` is above, since a screen without one has no theme to show. */
export default function useThemeContext(): ThemeContextValue {
	const value = useContext(ThemeContext);
	if (value === null) throw new Error("useThemeContext needs a ThemeRoot above it.");
	return value;
}
