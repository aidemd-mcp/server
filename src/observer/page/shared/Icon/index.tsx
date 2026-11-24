import type { CSSProperties } from "react";
import type { IconName } from "@/observer/page/types/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";

/**
 * One of the handoff's icons: a decorative mask drawn by `viewer.css` (`.ic.i-<name>`), hidden from
 * assistive technology because every use sits beside a word or inside a button that has a label.
 * `size` picks the 20px (`lg`) or 28px (`xl`) step; `spin` turns it, and reduced motion stops that.
 * `style` carries the handoff's one-off colours (`color: var(--danger)`) as CSSOM styles, which the
 * page's CSP allows.
 */
export default function Icon({
	name,
	size,
	spin,
	className,
	style,
}: {
	name: IconName;
	size?: "lg" | "xl";
	spin?: boolean;
	className?: string;
	style?: CSSProperties;
}) {
	return <span className={joinClasses("ic", size, `i-${name}`, spin && "spin", className)} aria-hidden="true" style={style} />;
}
