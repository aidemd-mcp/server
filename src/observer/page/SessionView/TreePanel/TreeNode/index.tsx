import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { TreeNodeModel } from "@/observer/page/types/index.js";
import AlignmentBadge from "@/observer/page/SessionView/TreePanel/AlignmentBadge/index.js";
import FileChip from "@/observer/page/SessionView/TreePanel/FileChip/index.js";

/**
 * One module of the intent tree: a chevron button that folds its branch (hidden on a leaf) and a
 * button that opens the module's detail, holding the path, alignment badge, `Working now` label,
 * `n modules hidden` when folded, the spec's description and the file chips. The working module
 * is tinted and a misaligned one is red-tinted; both also carry a word, so colour is never alone.
 */
export default function TreeNode({ node, onToggle, onOpen }: { node: TreeNodeModel; onToggle(): void; onOpen(): void }) {
	return (
		<div
			className={joinClasses("av-node", `d${node.depth}`, node.current !== null && "cur", node.misaligned && "mis")}
			role="treeitem"
			aria-expanded={node.hasChildren ? !node.collapsed : undefined}
		>
			<button
				type="button"
				className={joinClasses("tw", !node.hasChildren && "leaf")}
				aria-label={`${node.collapsed ? "Expand" : "Collapse"} ${node.path}`}
				onClick={onToggle}
			>
				<Icon name={node.collapsed ? "chev-r" : "chev-d"} />
			</button>
			<button type="button" className="n-main" onClick={onOpen}>
				<span className="n-top">
					<span className="n-path">{node.path}</span>
					{node.alignment !== null && <AlignmentBadge alignment={node.alignment} />}
					{node.current !== null && (
						<span className="av-badge run">
							<Icon name="run" />
							{node.current}
						</span>
					)}
					{node.hiddenCount > 0 && (
						<span className="n-more">{node.hiddenCount === 1 ? "1 module hidden" : `${node.hiddenCount} modules hidden`}</span>
					)}
				</span>
				{node.description !== null && <span className="n-desc">{node.description}</span>}
				{node.chips.length > 0 && (
					<span className="n-chips">
						{node.chips.map((chip) => (
							<FileChip key={chip.file} chip={chip} />
						))}
					</span>
				)}
			</button>
		</div>
	);
}
