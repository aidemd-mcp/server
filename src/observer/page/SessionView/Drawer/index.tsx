import { useId, useRef } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { DrawerContext, DrawerItem } from "@/observer/page/types/index.js";
import describeItem from "./describeItem/index.js";
import DrawerBlock from "./DrawerBlock/index.js";
import useDrawerFocus from "./useDrawerFocus/index.js";
import useDrawerModel from "./useDrawerModel/index.js";
import useEscapeToClose from "./useEscapeToClose/index.js";

/**
 * The detail drawer: one item's content on the right (full screen on a phone), drawn non-modal as the
 * handoff has it (`aria-modal="false"`) so the now card and rail stay in view, and named by its
 * visible title. Escape and the close button dismiss it; focus moves to the close button on open and
 * back to what opened it on close. While the item's files load it shows the header alone; a failed
 * read shows the observer's message in the body.
 */
export default function Drawer({ item, context, onClose }: { item: DrawerItem; context: DrawerContext; onClose(): void }) {
	const titleId = useId();
	const closeButton = useRef<HTMLButtonElement>(null);
	useEscapeToClose({ onClose });
	useDrawerFocus({ target: closeButton });
	const model = useDrawerModel({ item, context });
	const drawer = model.state === "ready" ? model.data : { ...describeItem({ item, context }), meta: null, blocks: [] };

	return (
		<aside className="av-drawer" role="dialog" aria-modal="false" aria-labelledby={titleId}>
			<div className="av-drawer-h">
				<div className="grow stack" style={{ gap: "2px" }}>
					<span className="d-k">{drawer.kind}</span>
					<span id={titleId} className={joinClasses("d-t", drawer.titleMono && "mono")}>
						{drawer.title}
					</span>
					{drawer.meta !== null && <span className="meta">{drawer.meta}</span>}
				</div>
				<button ref={closeButton} type="button" className="av-btn icon ghost" aria-label="Close details" onClick={onClose}>
					<Icon name="close" size="lg" />
				</button>
			</div>
			<div className="av-drawer-b">
				{drawer.blocks.map((block, index) => (
					<DrawerBlock key={index} block={block} />
				))}
			</div>
		</aside>
	);
}
