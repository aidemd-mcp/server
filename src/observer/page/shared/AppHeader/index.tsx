import type { ReactNode } from "react";

/** The page header every screen shares: `left` (brand and meta) and `right` (pill and theme button) in the handoff's two groups. */
export default function AppHeader({ left, right }: { left: ReactNode; right: ReactNode }) {
	return (
		<header className="av-hdr">
			<div className="av-hdr-l">{left}</div>
			<div className="av-hdr-r">{right}</div>
		</header>
	);
}
