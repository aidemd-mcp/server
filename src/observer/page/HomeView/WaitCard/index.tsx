import Icon from "@/observer/page/shared/Icon/index.js";
import type { WaitCardModel } from "@/observer/page/types/index.js";

/**
 * Home's amber card for one open gate: the loudest thing on the page. A real button, because the
 * whole card opens the session where the file waits. The page only shows status, so the card tells
 * the developer to answer in the agent's session; it offers no approval.
 */
export default function WaitCard({ card, onOpen }: { card: WaitCardModel; onOpen(): void }) {
	return (
		<button type="button" className="av-wait-card" onClick={onOpen}>
			<Icon name="wait" size="xl" />
			<span className="stack" style={{ gap: 2 }}>
				<span className="wc-k">Waiting on you · {card.project}</span>
				<span className="wc-what">
					Approve <span className="mono">{card.file}</span>
				</span>
				<span className="wc-where">
					for <span className="mono">{card.module}</span> · answer in the agent&apos;s session to continue
				</span>
			</span>
			<span className="wc-since">
				{card.since}
				<span>waiting since {card.at}</span>
			</span>
		</button>
	);
}
