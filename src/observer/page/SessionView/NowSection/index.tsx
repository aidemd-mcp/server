import type { LaneCell, NowCardModel, RailCell, SessionModel } from "@/observer/page/types/index.js";
import NowCard from "@/observer/page/SessionView/NowCard/index.js";
import PhaseRail from "@/observer/page/SessionView/PhaseRail/index.js";
import SideLanes from "@/observer/page/SessionView/SideLanes/index.js";

/**
 * The page's one-glance answer: the now card (left out while waiting, since the sticky waiting banner says it), then the pipeline rail with its side lanes, as one labelled section.
 * A session with no rail (an ended one) gets the card alone: no bar is drawn for the rail.
 */
export default function NowSection({ card, phases, lanes, rail }: { card: NowCardModel; phases: RailCell[]; lanes: LaneCell[]; rail: SessionModel["rail"] }) {
	return (
		<section className="av-now" aria-label="Now running">
			{card.kind !== "wait" && <NowCard card={card} />}
			{!rail.hidden && (
				<div className="av-rail-wrap">
					<PhaseRail phases={phases} pipeline={rail.pipeline} outside={rail.outside} />
					<SideLanes lanes={lanes} />
				</div>
			)}
		</section>
	);
}
