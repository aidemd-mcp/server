import { useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { DrawerSection, ModuleFileKind } from "@/observer/page/types/index.js";
import DrawerBlock from "../DrawerBlock/index.js";

/**
 * A module's files as accordion rows in the Details panel: each row is labelled with the file's
 * name and status and expands to that file's blocks. `open` is the row expanded first; the user can
 * open and close rows freely after that.
 */
export default function ModuleSections({ list, open }: { list: DrawerSection[]; open: ModuleFileKind }) {
	const [expanded, setExpanded] = useState<ReadonlySet<ModuleFileKind>>(() => new Set([open]));
	const toggle = (kind: ModuleFileKind): void => {
		const next = new Set(expanded);
		if (next.has(kind)) next.delete(kind);
		else next.add(kind);
		setExpanded(next);
	};
	return (
		<div className="av-files">
			{list.map((section) => {
				const isOpen = expanded.has(section.kind);
				return (
					<section key={section.kind} className={isOpen ? "av-file open" : "av-file"}>
						<button type="button" className="av-file-h" aria-expanded={isOpen} onClick={() => toggle(section.kind)} title={section.path}>
							<Icon name={isOpen ? "chev-d" : "chev-r"} />
							<span className="mono f-name">{section.label}</span>
							{section.status !== null && <span className="f-status">{section.status}</span>}
						</button>
						{isOpen && (
							<div className="av-file-b">
								{section.blocks.map((block, index) => (
									<DrawerBlock key={index} block={block} />
								))}
							</div>
						)}
					</section>
				);
			})}
		</div>
	);
}
