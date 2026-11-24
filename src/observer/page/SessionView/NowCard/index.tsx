import Icon from "@/observer/page/shared/Icon/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import StepBar from "./StepBar/index.js";

/**
 * The now card, the page's one-glance answer: the phase at 40px, the agent and module, the elapsed
 * time at 40px mono, the build step bar and a hint, in the state's colour and glyph (`run`, `wait`,
 * `fix`, `idle`, `empty`; only `wait` is amber). Its `h1` is the page's title. The ticking time is
 * hidden from assistive technology and a static label stands in for it, so the second counter is
 * never announced.
 */
export default function NowCard({ card }: { card: NowCardModel }) {
	return (
		<div className={`av-card ${card.kind}`}>
			<div className="c-main">
				<div className="c-state">
					<Icon name={card.icon} size="lg" />
					{card.state}
				</div>
				<h1 className="c-title">
					<span>
						{card.title}
						{card.titleMono !== null && <> <span className="mono">{card.titleMono}</span></>}
					</span>
					{card.sub !== null && <span className="sub">{card.sub}</span>}
				</h1>
				<div className="c-line">
					{card.parts.map((part) => (
						<span key={part.label}>
							<span className="lbl">{part.label}</span>
							<span className={part.mono ? "mono" : undefined}>{part.value}</span>
						</span>
					))}
				</div>
			</div>
			{card.time !== null && (
				<div className="c-time">
					<span className="big" aria-hidden="true">
						{card.time}
					</span>
					<span className="lbl" aria-hidden="true">
						{card.timeLabel}
					</span>
					<span className="sr">{card.timeLabel}</span>
				</div>
			)}
			{card.steps !== null && (
				<div className="c-steps">
					<div className="row wrap" style={{ gap: "4px 10px" }}>
						<b>{card.steps.head}</b>
						{card.steps.text !== null && <span className="t2">{card.steps.text}</span>}
					</div>
					<StepBar total={card.steps.total} done={card.steps.done} running={card.steps.running} label={card.steps.head} />
				</div>
			)}
			{card.hint !== null && <p className="c-hint">{card.hint}</p>}
		</div>
	);
}
