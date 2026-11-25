import { useId, useRef, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { DrawerContext, DrawerItem } from "@/observer/page/types/index.js";
import describeItem from "./describeItem/index.js";
import DrawerBlock from "./DrawerBlock/index.js";
import ModuleSections from "./ModuleSections/index.js";
import pickKindIcon from "./pickKindIcon/index.js";
import useMoreBelow from "./useMoreBelow/index.js";
import type { IconName, TreeAlignment } from "@/observer/page/types/index.js";

/** The caption over the docked title, saying what the title is. */
function titleCaption(kind: string): string {
	if (kind.startsWith("Module")) return "Module path";
	if (kind.startsWith("File")) return "File path";
	if (kind.startsWith("Task")) return "Task title";
	return "Title";
}

/** The status icon per alignment in the compact header (the tree's glyphs). */
const ALIGN_ICON: Record<TreeAlignment, IconName> = { aligned: "done", unreviewed: "todo", misaligned: "fail" };
import useDrawerFocus from "./useDrawerFocus/index.js";
import useDrawerModel from "./useDrawerModel/index.js";
import useEscapeToClose from "./useEscapeToClose/index.js";

/**
 * The detail drawer: one item's content on the right (full screen on a phone), drawn non-modal as the
 * handoff has it (`aria-modal="false"`) so the now card and rail stay in view, and named by its
 * visible title. Escape and the close button dismiss it; focus moves to the close button on open and
 * back to what opened it on close. While the item's files load it shows the header alone; a failed
 * read shows the observer's message in the body. `docked` draws it in the history column instead
 * (desktop), so it covers nothing; closing it brings History back.
 */
export default function Drawer({ item, context, docked = false, onClose }: { item: DrawerItem; context: DrawerContext; docked?: boolean; onClose(): void }) {
	const titleId = useId();
	const closeButton = useRef<HTMLButtonElement>(null);
	const [body, setBody] = useState<HTMLDivElement | null>(null);
	const moreBelow = useMoreBelow(body);
	useEscapeToClose({ onClose });
	useDrawerFocus({ target: closeButton });
	const model = useDrawerModel({ item, context });
	const drawer = model.state === "ready" ? model.data : { ...describeItem({ item, context }), meta: null, blocks: [] };

	return (
		<aside className={joinClasses("av-drawer", docked && "docked")} role="dialog" aria-modal="false" aria-labelledby={titleId}>
			{docked ? (
				<div className="av-drawer-h compact">
					<span className="d-kind">
						<Icon name={pickKindIcon(drawer.kind)} />
						{drawer.kind}
					</span>
				</div>
			) : (
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
			)}
			<div ref={setBody} className="av-drawer-b">
				{docked && (
					<div className="d-titleblock">
						<span className="d-cap">{titleCaption(drawer.kind)}</span>
						<span id={titleId} className={joinClasses("d-t", drawer.titleMono && "mono")}>
							{drawer.title}
						</span>
						{drawer.alignment != null ? (
							<span className={`d-align ${drawer.alignment}`}>
								<Icon name={ALIGN_ICON[drawer.alignment]} />
								{drawer.alignment}
							</span>
						) : (
							drawer.meta !== null && <span className="d-meta mono">{drawer.meta}</span>
						)}
						{drawer.taskChips !== undefined && (
							<span className="pm-task-chips">
								<span className="av-badge neutral">{drawer.taskChips.column}</span>
								{drawer.taskChips.priority !== null && <span className={`av-badge av-prio ${drawer.taskChips.priority}`}>{drawer.taskChips.priority}</span>}
								{drawer.taskChips.type !== null && <span className="av-badge outline">{drawer.taskChips.type}</span>}
							</span>
						)}
					</div>
				)}
				{model.state === "ready" && drawer.blocks.length === 0 && (drawer.sections === undefined || drawer.sections.list.length === 0) && (
					<p className="t3 d-empty">This note has no details beyond its title.</p>
				)}
				{drawer.sections !== undefined ? (
					<ModuleSections key={`${drawer.title}:${drawer.sections.open}`} list={drawer.sections.list} open={drawer.sections.open} />
				) : (
					drawer.blocks.map((block, index) => <DrawerBlock key={index} block={block} />)
				)}
			</div>
			{moreBelow && (
				<div className="av-more" aria-hidden="true">
					<button type="button" tabIndex={-1} onClick={() => body?.scrollBy({ top: body.clientHeight * 0.8, behavior: "smooth" })}>
						More below
						<Icon name="chev-d" />
					</button>
				</div>
			)}
		</aside>
	);
}
