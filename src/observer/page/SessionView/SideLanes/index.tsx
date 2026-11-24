import Icon from "@/observer/page/shared/Icon/index.js";
import type { LaneCell } from "@/observer/page/types/index.js";
import pickRailIcon from "@/observer/page/SessionView/pickRailIcon/index.js";

/** The four side lanes (Structure, Align, Refactor, Cleanup) under the rail, each a pill with its state's glyph, its name and a meta word. */
export default function SideLanes({ lanes }: { lanes: LaneCell[] }) {
	return (
		<div className="av-lanes">
			<span className="l-lbl">Side lanes</span>
			{lanes.map((lane) => (
				<span key={lane.name} className={`av-lane ${lane.state}`}>
					<Icon name={pickRailIcon({ state: lane.state })} />
					{lane.name} <span className="s">{lane.meta}</span>
				</span>
			))}
		</div>
	);
}
