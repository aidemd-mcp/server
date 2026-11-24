import AppHeader from "@/observer/page/shared/AppHeader/index.js";
import ConnectionPill from "@/observer/page/shared/ConnectionPill/index.js";
import ThemeButton from "@/observer/page/shared/ThemeButton/index.js";
import useThemeContext from "@/observer/page/shared/useThemeContext/index.js";
import type { ConnState, SessionHeaderModel } from "@/observer/page/types/index.js";
import openSession from "@/observer/page/HomeView/openSession/index.js";
import SessionSwitcher from "./SessionSwitcher/index.js";

/**
 * The session view's header: the breadcrumb home (`All projects / <project> / session HH:MM`, the
 * last part the current page), the reported root and kanban tag where known, the switcher while two
 * sessions are live, the connection pill and the theme switch. `conn` is null for a session the
 * observer has no recording of, which has nothing live to show a pill for.
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
				<>
					<nav className="av-crumb" aria-label="Breadcrumb">
						<button type="button" className="av-linkbtn" onClick={() => openSession({ href: header.homeHref })}>
							All projects
						</button>
						<span className="sep" aria-hidden="true">
							/
						</span>
						<span>{header.project}</span>
						{header.sessionStart !== null && (
							<>
								<span className="sep" aria-hidden="true">
									/
								</span>
								<span className="here" aria-current="page">
									session {header.sessionStart}
								</span>
							</>
						)}
					</nav>
					{(header.rootPath !== null || header.kanbanTag !== null) && (
						<div className="av-hdr-meta">
							{header.rootPath !== null && <span className="mono">{header.rootPath}</span>}
							{header.rootPath !== null && header.kanbanTag !== null && <span className="dot-sep" aria-hidden="true" />}
							{header.kanbanTag !== null && (
								<span>
									kanban <span className="mono">{header.kanbanTag}</span>
								</span>
							)}
						</div>
					)}
				</>
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
