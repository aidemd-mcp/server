import Icon from "@/observer/page/shared/Icon/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import type { DrawerItem, TreePanelModel, TreeView } from "@/observer/page/types/index.js";
import buildTreeRows from "@/observer/page/SessionView/buildTreeRows/index.js";
import FilterMenu from "./FilterMenu/index.js";
import pickParents from "./pickParents/index.js";
import toggleFolder from "./toggleFolder/index.js";
import TreeNode from "./TreeNode/index.js";

/** The handoff's size for the path filter field (set on the field, not in the stylesheet). */
const FIELD_STYLE = { flex: "1 1 200px", maxWidth: "300px" };

/**
 * The intent tree tab: a toolbar (path filter, `Only open work`, `Only misaligned`, one `Expand all` /
 * `Collapse all` toggle, the count line) over the tree. The query, the two toggles and the folded folders
 * are the `view` it is given and every change goes out through `onChange`, since they belong to the
 * viewer and outlive this panel's mount. A project that never reported its folder gets the calm
 * unavailable notice instead.
 */
export default function TreePanel({
	tree,
	view,
	onChange,
	onOpen,
}: {
	tree: TreePanelModel;
	view: TreeView;
	onChange(view: TreeView): void;
	onOpen(item: DrawerItem): void;
}) {
	const { query, onlyOpen, onlyMisaligned, onlyPlans, onlyTodos, collapsed } = view;

	if (tree.kind === "unavailable") {
		return (
			<Notice tone="calm" icon="folder-off" iconSize="lg" heading="Intent tree unavailable">
				<p>
					This project never reported its folder, so there&apos;s no <span className="mono">.aide</span> tree to read. It appears after the
					agent starts a session that reports the project root. History and sessions below still work.
				</p>
			</Notice>
		);
	}

	const { nodes, countLine } = buildTreeRows({ tree, query, onlyOpen, onlyMisaligned, onlyPlans, onlyTodos, collapsed });
	return (
		<>
			<div className="av-toolbar">
				<label className="av-field" style={FIELD_STYLE}>
					<Icon name="search" />
					<span className="sr">Filter modules by path</span>
					<input type="search" placeholder="Filter by path" value={query} onChange={(event) => onChange({ ...view, query: event.target.value })} />
				</label>
				<FilterMenu view={view} onChange={onChange} />
				<button
					type="button"
					className="av-btn ghost"
					onClick={() => onChange({ ...view, collapsed: collapsed.size > 0 ? new Set() : new Set(pickParents({ tree })) })}
				>
					<Icon name={collapsed.size > 0 ? "chev-d" : "chev-r"} />
					{collapsed.size > 0 ? "Expand all" : "Collapse all"}
				</button>
				<span className="count">{countLine}</span>
			</div>
			<div className="av-tree" role="tree" aria-label="Intent tree">
				{nodes.map((node) => (
					<TreeNode
						key={node.folder}
						node={node}
						onToggle={() => onChange({ ...view, collapsed: toggleFolder({ collapsed, folder: node.folder }) })}
						onOpenFile={(path) => onOpen({ kind: "file", path })}
					/>
				))}
				{nodes.length === 0 && <div className="av-tree-foot">No modules match these filters.</div>}
			</div>
		</>
	);
}
