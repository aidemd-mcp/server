import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { readFile } from "node:fs/promises";
import type { AideFile, AideFrontmatter, BodySection, TreeNode } from "@/types/index.js";
import flattenTree from "@/cli/flattenTree/index.js";
import type { FlatNode } from "@/cli/flattenTree/index.js";
import buildTreeData from "@/cli/buildTreeData/index.js";
import TreePanel from "@/cli/TreePanel/index.js";
import DetailPanel from "@/cli/DetailPanel/index.js";
import DrillInPanel from "@/cli/DrillInPanel/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import parseBody from "@/util/parseBody/index.js";
import scan from "@/util/scan/index.js";

type Mode = "tree" | "drill-in";

interface DrillData {
	frontmatter: AideFrontmatter | null;
	sections: BodySection[];
}

interface AppProps {
	/** Project root to scan. */
	root: string;
	/** Initial shallow scan results already loaded before render. */
	initialNodes: TreeNode[];
}

/**
 * Top-level TUI orchestrator. Owns view state (tree vs drill-in) and delegates
 * to TreePanel, DetailPanel, and DrillInPanel. Handles all keyboard input.
 */
export default function App({ root, initialNodes }: AppProps): React.ReactElement {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const columns = stdout?.columns ?? 80;

	// --- Tree state ---
	// Cache shallow results so toggling back from deep view restores them instantly.
	const [shallowNodes] = useState<TreeNode[]>(initialNodes);
	const [shallowFlatNodes] = useState<FlatNode[]>(() => flattenTree(initialNodes));
	const [treeNodes, setTreeNodes] = useState<TreeNode[]>(initialNodes);
	const [flatNodes, setFlatNodes] = useState<FlatNode[]>(() => flattenTree(initialNodes));
	const [cursorIndex, setCursorIndex] = useState(0);
	const [searchFilter, setSearchFilter] = useState("");
	const [isDeepView, setIsDeepView] = useState(false);
	const [deepLoading, setDeepLoading] = useState(false);

	// --- View mode ---
	const [mode, setMode] = useState<Mode>("tree");

	// --- Drill-in state ---
	const [drilledFile, setDrilledFile] = useState<AideFile | null>(null);
	const [drillData, setDrillData] = useState<DrillData | null>(null);
	const [drillCache] = useState<Map<string, DrillData>>(new Map());
	// Drill-in keyboard state: focused section index and expanded set.
	const [drillFocused, setDrillFocused] = useState(0);
	const [drillExpanded, setDrillExpanded] = useState<Set<number>>(new Set());

	// --- Detail panel frontmatter (for currently selected file) ---
	const [selectedFrontmatter, setSelectedFrontmatter] = useState<AideFrontmatter | null>(null);
	const [fmCache] = useState<Map<string, AideFrontmatter | null>>(new Map());

	// Compute visible flat nodes from a single source of truth in App.
	// Dir nodes are included only when at least one of their file descendants matches.
	const visibleNodes: FlatNode[] = searchFilter
		? flatNodes.filter((fn) => {
			if (fn.node.kind === "dir") {
				const dirPath = fn.node.path;
				return flatNodes.some(
					(child) =>
						child.node.kind === "file" &&
						child.node.file.relativePath.startsWith(dirPath) &&
						child.node.file.relativePath.toLowerCase().includes(searchFilter.toLowerCase()),
				);
			}
			return (
				fn.node.file.relativePath.toLowerCase().includes(searchFilter.toLowerCase()) ||
				(fn.node.file.summary ?? "").toLowerCase().includes(searchFilter.toLowerCase())
			);
		  })
		: flatNodes;

	// Clamp cursor within visible range.
	const clampedCursor = Math.min(cursorIndex, Math.max(0, visibleNodes.length - 1));

	// Current selected file (from cursor position in visibleNodes).
	const cursorNode = visibleNodes[clampedCursor];
	const selectedFile = cursorNode?.node.kind === "file" ? cursorNode.node.file : null;

	// Load frontmatter for the detail panel whenever selectedFile changes.
	useEffect(() => {
		if (!selectedFile) {
			setSelectedFrontmatter(null);
			return;
		}
		if (fmCache.has(selectedFile.path)) {
			setSelectedFrontmatter(fmCache.get(selectedFile.path) ?? null);
			return;
		}
		readFile(selectedFile.path, "utf-8")
			.then((content) => {
				const { frontmatter } = parseFrontmatter(content);
				fmCache.set(selectedFile.path, frontmatter);
				setSelectedFrontmatter(frontmatter);
			})
			.catch(() => {
				fmCache.set(selectedFile.path, null);
				setSelectedFrontmatter(null);
			});
	}, [selectedFile?.path]);

	/** Load and parse a file for drill-in view. */
	const drillIntoFile = useCallback(async (file: AideFile) => {
		setDrilledFile(file);
		setDrillFocused(0);
		setDrillExpanded(new Set());
		setMode("drill-in");

		if (drillCache.has(file.path)) {
			setDrillData(drillCache.get(file.path)!);
			return;
		}

		try {
			const content = await readFile(file.path, "utf-8");
			const { frontmatter, body } = parseFrontmatter(content);
			const sections = parseBody(body);
			const data: DrillData = { frontmatter, sections };
			drillCache.set(file.path, data);
			setDrillData(data);
		} catch {
			setDrillData({ frontmatter: null, sections: [] });
		}
	}, [drillCache]);

	/** Toggle deep view on/off, caching shallow results for instant restore. */
	const toggleDeepView = useCallback(async () => {
		if (isDeepView) {
			// Restore cached shallow results — no re-scan needed.
			setTreeNodes(shallowNodes);
			setFlatNodes(shallowFlatNodes);
			setIsDeepView(false);
			return;
		}
		setDeepLoading(true);
		try {
			const result = await scan(root, undefined, false);
			const nodes = buildTreeData(result.files);
			setTreeNodes(nodes);
			setFlatNodes(flattenTree(nodes));
		} catch {
			// Silently keep current state on scan failure.
		} finally {
			setDeepLoading(false);
			setIsDeepView(true);
		}
	}, [isDeepView, root, shallowNodes, shallowFlatNodes]);

	// --- Keyboard handling ---
	useInput((input, key) => {
		if (mode === "tree") {
			if (key.upArrow) {
				setCursorIndex((c) => Math.max(0, c - 1));
				return;
			}
			if (key.downArrow) {
				setCursorIndex((c) => Math.min(visibleNodes.length - 1, c + 1));
				return;
			}
			if (key.return) {
				if (selectedFile) drillIntoFile(selectedFile);
				return;
			}
			if (key.tab) {
				toggleDeepView();
				return;
			}
			if (key.escape) {
				if (searchFilter) {
					setSearchFilter("");
					setCursorIndex(0);
				} else {
					exit();
				}
				return;
			}
			if (key.backspace || key.delete) {
				setSearchFilter((f) => f.slice(0, -1));
				return;
			}
			// Printable characters: append to search filter.
			if (input && !key.ctrl && !key.meta && input.length === 1) {
				setSearchFilter((f) => f + input);
				setCursorIndex(0);
			}
			return;
		}

		// Drill-in mode.
		if (key.escape || key.backspace) {
			setMode("tree");
			setDrilledFile(null);
			setDrillData(null);
			return;
		}

		const sectionCount = (drillData?.sections ?? []).filter((s) => s.heading !== "").length;

		if (key.upArrow) {
			setDrillFocused((f) => Math.max(0, f - 1));
			return;
		}
		if (key.downArrow) {
			setDrillFocused((f) => Math.min(Math.max(0, sectionCount - 1), f + 1));
			return;
		}
		if (key.return) {
			if (sectionCount === 0) return;
			setDrillExpanded((prev) => {
				const next = new Set(prev);
				if (next.has(drillFocused)) {
					next.delete(drillFocused);
				} else {
					next.add(drillFocused);
				}
				return next;
			});
		}
	});

	// --- Layout ---
	const treeWidth = Math.floor(columns * 0.38);

	if (mode === "drill-in" && drilledFile) {
		const label = drilledFile.relativePath;
		return (
			<Box flexDirection="column" width={columns}>
				<DrillInPanel
					label={label}
					frontmatter={drillData?.frontmatter ?? null}
					sections={drillData?.sections ?? []}
					focusedSection={drillFocused}
					expanded={drillExpanded}
				/>
			</Box>
		);
	}

	return (
		<Box flexDirection="row" width={columns}>
			{/* Left: tree panel with border */}
			<Box
				flexDirection="column"
				width={treeWidth}
				borderStyle="single"
				borderColor="white"
			>
				<Text bold> Intent Tree</Text>
				{deepLoading && <Text color="yellow">  Loading summaries...</Text>}
				<TreePanel
					visibleNodes={visibleNodes}
					cursorIndex={clampedCursor}
					searchFilter={searchFilter}
					isDeepView={isDeepView}
				/>
			</Box>

			{/* Right: detail panel with border */}
			<Box
				flexDirection="column"
				flexGrow={1}
				borderStyle="single"
				borderColor="white"
			>
				<Text bold> Detail</Text>
				<DetailPanel file={selectedFile} frontmatter={selectedFrontmatter} />
			</Box>
		</Box>
	);
}
