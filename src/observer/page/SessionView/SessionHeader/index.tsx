import AppHeader from "@/observer/page/shared/AppHeader/index.js";
import ConnectionPill from "@/observer/page/shared/ConnectionPill/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import ThemeButton from "@/observer/page/shared/ThemeButton/index.js";
import useThemeContext from "@/observer/page/shared/useThemeContext/index.js";
import type { ConnState, SessionHeaderModel } from "@/observer/page/types/index.js";
import openSession from "@/observer/page/HomeView/openSession/index.js";
import SessionSwitcher from "./SessionSwitcher/index.js";

/**
 * The session view's header: a `Projects` button back to Home (with the AIDE mark), the project's
 * name as the title; on the right the switcher while two sessions are live, the connection pill and
 * the theme switch. The session picker lives in the History bar, since a session only changes the
 * history, the phase rail and the waiting state; everything else is the project's current files. The project folder and kanban tag
 * live in the Sessions tab, not here. `conn` is null for a session the observer has no recording of.
 */
export default function SessionHeader({
	header,
	conn,
	onPickSession,
}: {
	header: SessionHeaderModel;
	conn: ConnState | null;
	onPickSession(id: string): void;
}) {
	const { theme, toggle } = useThemeContext();
	return (
		<AppHeader
			left={
				<nav className="av-hnav" aria-label="Navigation">
					<button type="button" className="av-btn av-home-btn" onClick={() => openSession({ href: header.homeHref })}>
						<span className="av-logo" aria-hidden="true">
							A
						</span>
						<Icon name="chev-r" className="flip" />
						Projects
					</button>
					<span className="av-hnav-title">{header.project}</span>
				</nav>
			}
			right={
				<>
					{header.switcher.length >= 2 && <SessionSwitcher options={header.switcher} onPick={onPickSession} />}
					{conn !== null && <ConnectionPill state={conn} />}
					<ThemeButton theme={theme} onToggle={toggle} />
				</>
			}
		/>
	);
}
