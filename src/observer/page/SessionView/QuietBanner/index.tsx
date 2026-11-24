import Icon from "@/observer/page/shared/Icon/index.js";

const SENTENCE =
	"The viewer server restarted. This page reconnects by itself and nothing is lost — events from the gap appear when it's back.";

/**
 * The quiet strip shown while the stream reconnects: neutral, never an error, with the reconnect
 * icon turning (reduced motion stops it). `lastUpdate` is the clock time of the newest held event;
 * with none, the clause is left out.
 */
export default function QuietBanner({ lastUpdate }: { lastUpdate: string | null }) {
	return (
		<div className="av-quiet-banner" role="status">
			<Icon name="reconnect" size="lg" spin />
			<span>
				<b>Reconnecting…</b>
				{lastUpdate === null ? ` ${SENTENCE}` : ` ${SENTENCE} Last update ${lastUpdate}.`}
			</span>
		</div>
	);
}
