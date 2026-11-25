import Icon from "@/observer/page/shared/Icon/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import StepBar from "../NowCard/StepBar/index.js";

/**
 * The desktop session page's slim status bar: the now card as one full-width 64px row under the
 * header, the same shape as the waiting banner but in the state's quieter colour. It reads the
 * state word and glyph, the pipeline and phase and its sub line (`step 4 of 9`), each labelled part (agent,
 * module), the current step's text with a compact step bar, and the elapsed time on the right. It
 * never scrolls away, since the page's frame keeps it above the main area. The ticking time is hidden
 * from assistive technology; its static label stands in for it.
 */
export default function RunBar({ card }: { card: NowCardModel }) {
	return (
		<div className={`av-runbar ${card.kind}`} role="status">
			<span className="rb-state">
				<Icon name={card.icon} />
				{card.state}
			</span>
			<span className="rb-title">
				{card.pipeline != null && `${card.pipeline} · `}
				{card.title}
				{card.titleMono !== null && <span className="mono"> {card.titleMono}</span>}
				{card.sub !== null && <span className="rb-sub"> {card.sub}</span>}
			</span>
			{card.parts.map((part) => (
				<span key={part.label} className="rb-part">
					<span className="lbl">{part.label}</span>
					<span className={part.mono ? "mono" : undefined}>{part.value}</span>
				</span>
			))}
			{card.steps !== null && (
				<span className="rb-steps" title={card.steps.text ?? undefined}>
					{card.steps.text !== null && <span className="rb-step-text">{card.steps.text}</span>}
					<StepBar total={card.steps.total} done={card.steps.done} running={card.steps.running} label={card.steps.head} />
				</span>
			)}
			{card.time !== null && (
				<span className="rb-time">
					<span className="mono" aria-hidden="true">
						{card.time}
					</span>
					<span className="sr">{card.timeLabel}</span>
				</span>
			)}
		</div>
	);
}
