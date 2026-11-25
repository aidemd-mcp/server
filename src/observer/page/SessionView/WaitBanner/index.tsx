import Icon from "@/observer/page/shared/Icon/index.js";
import type { DrawerItem, WaitBannerModel } from "@/observer/page/types/index.js";

/**
 * The full-width amber waiting banner at the top of the session view while a gate is open. Its one
 * 64px row (what waits, for which module, since when, and a button that opens the waiting file)
 * sticks under the header (`top` is the header's measured height) and never changes height. On a
 * phone the row keeps the hand, the words and the button, and a strip below it (phone only) carries
 * what and since and scrolls away under the row.
 * The row is a status region, announced once when it appears; the `since` text ticks, so it is
 * hidden from assistive technology rather than re-announced. It offers no approval, only the
 * reminder to answer in the agent's session.
 */
export default function WaitBanner({
	file,
	module,
	since,
	path,
	top,
	onOpen,
}: WaitBannerModel & { top: number; onOpen(item: DrawerItem): void }) {
	const what = (
		<>
			approve <span className="mono">{file}</span> for <span className="mono">{module}</span>
		</>
	);
	return (
		<>
			<div className="av-wait-banner" role="status" style={{ top }}>
				<span className="w-k">
					<Icon name="wait" size="xl" />
					Waiting on you
				</span>
				<span className="w-what">{what}</span>
				<span className="w-since" aria-hidden="true">
					since {since}
				</span>
				<button type="button" className="w-open" onClick={() => onOpen({ kind: "file", path })}>
					<Icon name="doc" />
					Open {file}
				</button>
			</div>
			<div className="av-wait-hint">
				<span className="h-what">
					{what} <span aria-hidden="true">· since {since}</span>
				</span>
			</div>
		</>
	);
}
