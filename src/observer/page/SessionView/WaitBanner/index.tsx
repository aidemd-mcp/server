import Icon from "@/observer/page/shared/Icon/index.js";

/**
 * The amber strip above everything in the session view while a gate is open: what waits, for which
 * module and since when. A status region, so it is announced once when it appears; the `since` span
 * ticks, so it is hidden from assistive technology rather than re-announced. It offers no approval,
 * only the reminder to answer in the agent's session.
 */
export default function WaitBanner({ file, module, since }: { file: string; module: string; since: string }) {
	return (
		<div className="av-wait-banner" role="status">
			<span className="w-k">
				<Icon name="wait" size="xl" />
				Waiting on you
			</span>
			<span className="w-what">
				approve <span className="mono">{file}</span> for <span className="mono">{module}</span>
			</span>
			<span className="w-since" aria-hidden="true">
				since {since}
			</span>
			<span className="w-hint">The agent is paused until you answer in its session. This page only shows status — it can&apos;t approve.</span>
		</div>
	);
}
