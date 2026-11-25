import type { LaneCell, NowCardModel, RailCell } from "@/observer/page/types/index.js";
import NowCard from "@/observer/page/SessionView/NowCard/index.js";
import PhaseRail from "@/observer/page/SessionView/PhaseRail/index.js";
import SideLanes from "@/observer/page/SessionView/SideLanes/index.js";

/** The page's one-glance answer: the now card (left out while waiting, since the sticky waiting banner says it), then the phase rail with its side lanes, as one labelled section. */
export default function NowSection({ card, phases, lanes }: { card: NowCardModel; phases: RailCell[]; lanes: LaneCell[] }) {
	return (
		<section className="av-now" aria-label="Now running">
			{card.kind !== "wait" && <NowCard card={card} />}
			<div className="av-rail-wrap">
				<PhaseRail phases={phases} />
				<SideLanes lanes={lanes} />
			</div>
		</section>
	);
}
