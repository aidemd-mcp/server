import { createContext } from "react";
import type { ThemeContextValue } from "@/observer/page/types/index.js";

/** The theme and its toggle, provided by `ThemeRoot`; null outside it, which `useThemeContext` refuses. */
const ThemeContext = createContext<ThemeContextValue | null>(null);

export default ThemeContext;
