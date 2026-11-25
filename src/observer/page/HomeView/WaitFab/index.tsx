import { useEffect, useRef, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { WaitCardModel } from "@/observer/page/types/index.js";

/**
 * Home's floating "waiting on you" button: an amber pill fixed to the bottom-right corner that
 * appears only while a gate is open somewhere (`✋ 2 waiting`), so it never pushes the page around.
 * Clicking it opens a small list of what waits (project, file and module, how long); clicking an
 * entry opens that project. Escape or a click outside closes the list.
 */
export default function WaitFab({ cards, onOpen }: { cards: WaitCardModel[]; onOpen(href: string): void }) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const away = (event: MouseEvent): void => {
			if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
		};
		const escape = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", away);
		document.addEventListener("keydown", escape);
		return () => {
			document.removeEventListener("mousedown", away);
			document.removeEventListener("keydown", escape);
		};
	}, [open]);

	if (cards.length === 0) return null;
	return (
		<div className="av-fab" ref={root}>
			{open && (
				<div className="av-fab-list" role="dialog" aria-label="Waiting on you">
					<div className="fl-h">Waiting on you</div>
					{cards.map((card) => (
						<button key={card.key} type="button" className="fl-item" onClick={() => onOpen(card.href)}>
							<span className="fl-p">{card.project}</span>
							<span className="fl-what">
								approve <span className="mono">{card.file}</span> for <span className="mono">{card.module}</span>
							</span>
							<span className="fl-since mono">{card.since}</span>
						</button>
					))}
				</div>
			)}
			<button type="button" className="av-fab-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
				<Icon name="wait" size="lg" />
				{cards.length} waiting
			</button>
		</div>
	);
}
