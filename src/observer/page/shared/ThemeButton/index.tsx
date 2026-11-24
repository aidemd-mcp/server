import type { Theme } from "@/observer/page/types/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";

/**
 * The header's theme switch: an icon-only button, so it carries the label of what a click does
 * (carried fix 2). Shows the sun on dark (switch to light) and the moon on light.
 */
export default function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle(): void }) {
	return (
		<button
			type="button"
			className="av-btn icon"
			aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
			onClick={onToggle}
		>
			<Icon name={theme === "dark" ? "sun" : "moon"} size="lg" />
		</button>
	);
}
