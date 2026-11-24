import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { SessionTab, TabModel } from "@/observer/page/types/index.js";

/**
 * The session view's tab strip (`role=tablist`): each tab a glyph, its label and, where it has one,
 * a count (danger-toned for misaligned modules and an offline board). History is marked phone-only
 * and the stylesheet shows it only on a phone. The panel it controls is `#session-panel`, labelled
 * by the selected tab.
 */
export default function Tabs({ tabs, selected, onPick }: { tabs: TabModel[]; selected: SessionTab; onPick(tab: SessionTab): void }) {
	return (
		<div className="av-tabs" role="tablist" aria-label="Session views">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					role="tab"
					id={`tab-${tab.id}`}
					aria-selected={selected === tab.id}
					aria-controls="session-panel"
					className={tab.phoneOnly ? "only-phone" : undefined}
					onClick={() => onPick(tab.id)}
				>
					<Icon name={tab.icon} />
					{tab.label}
					{tab.count !== null && <span className={joinClasses("n", tab.tone === "danger" && "danger")}>{tab.count}</span>}
				</button>
			))}
		</div>
	);
}
