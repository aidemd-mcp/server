import Icon from "@/observer/page/shared/Icon/index.js";
import type { RailCell, RailView } from "@/observer/page/types/index.js";
import pickRailIcon from "@/observer/page/SessionView/pickRailIcon/index.js";

type PhaseRailProps = { phases: RailCell[] } & Partial<Pick<RailView, "pipeline" | "outside" | "hidden">>;

/**
 * The nine phases as one row of cells joined by a line, each with its state's class and glyph, its
 * name and one meta line (`Step 4 of 9`, `Round 2 · 1m 05s`); a running Fix wears the `round <r>`
 * loop badge. The row scrolls sideways inside `.av-rail-scroll` on a phone and nowhere else, and the
 * scroller is focusable so the keyboard can reach it. A footer names the pipeline (`Pipeline <id>`;
 * none for a session that reported no pipeline) and, when the session works outside the pipeline,
 * says `Working outside the pipeline`. A hidden rail (no rail for the session) draws nothing.
 */
export default function PhaseRail({ phases, pipeline = null, outside = false, hidden = false }: PhaseRailProps) {
	if (hidden) return null;
	return (
		<>
			<div className="av-rail-scroll" role="region" tabIndex={0} aria-label="Pipeline phases; scrolls sideways on small screens">
				<ol className="av-rail">
					{phases.map((cell) => (
						<li key={cell.name} className={cell.skipped ? `av-ph ${cell.state} skip` : `av-ph ${cell.state}`}>
							{cell.loop !== null && (
								<span className="p-loop">
									<Icon name="loop" />
									{cell.loop}
								</span>
							)}
							<span className="p-top">
								<Icon name={pickRailIcon({ state: cell.state })} />
								{cell.name}
							</span>
							<span className="p-meta">{cell.meta}</span>
						</li>
					))}
				</ol>
			</div>
			{(pipeline !== null || outside) && (
				<p className="av-rail-foot">
					{pipeline !== null && <span className="rf-pipe">{`Pipeline ${pipeline}`}</span>}
					{outside && <span className="rf-out">Working outside the pipeline</span>}
				</p>
			)}
		</>
	);
}
