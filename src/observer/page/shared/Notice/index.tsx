import type { CSSProperties, ReactNode } from "react";
import type { IconName } from "@/observer/page/types/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";

/**
 * The handoff's notice box: an icon beside a heading and its paragraphs. `calm` (dashed) is for
 * unavailable and empty states, `err` for the one area that failed, default for a plain message.
 * `role="status"` is for a notice that appears or changes while the page is open. `style` is the
 * handoff's one-off spacing on the notice box itself, set through CSSOM (the page's CSP allows it).
 */
export default function Notice({
	tone,
	icon,
	iconSize,
	heading,
	children,
	role,
	style,
}: {
	tone?: "default" | "calm" | "err";
	icon: IconName;
	iconSize: "lg" | "xl";
	heading: string;
	children?: ReactNode;
	role?: "status";
	style?: CSSProperties;
}) {
	return (
		<div className={joinClasses("av-notice", tone !== "default" && tone)} role={role} style={style}>
			<Icon name={icon} size={iconSize} />
			<div>
				<h3>{heading}</h3>
				{children}
			</div>
		</div>
	);
}
