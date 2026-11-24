import type { ReactNode } from "react";
import type { SessionTab } from "@/observer/page/types/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import useNarrow from "@/observer/page/shared/useNarrow/index.js";
import useTheme from "@/observer/page/shared/useTheme/index.js";

/**
 * The page root every screen sits in: `<div class="av t-<theme> phone|desk tab-<tab>">`. Owns the
 * theme (stored choice, else the visitor's colour scheme) and the phone breakpoint, and hands the
 * theme and its toggle to the screen through `ThemeContext`. `tab` is set on the session view only.
 */
export default function ThemeRoot({ tab, children }: { tab?: SessionTab; children: ReactNode }) {
	const { theme, toggle } = useTheme();
	const narrow = useNarrow();
	return (
		<ThemeContext.Provider value={{ theme, toggle }}>
			<div className={joinClasses("av", `t-${theme}`, narrow ? "phone" : "desk", tab && `tab-${tab}`)}>{children}</div>
		</ThemeContext.Provider>
	);
}
