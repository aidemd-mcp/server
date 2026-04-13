import React, { useState, useCallback, useEffect, useMemo } from "react";
import { spawnSync } from "node:child_process";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { readFile } from "node:fs/promises";
import type { AideFile, AideFrontmatter, BodySection, TreeNode } from "@/types/index.js";
import flattenTree from "@/cli/flattenTree/index.js";
import type { FlatNode } from "@/cli/flattenTree/index.js";
import buildTreeData from "@/cli/buildTreeData/index.js";
import TreePanel from "@/cli/TreePanel/index.js";
import DetailPanel from "@/cli/DetailPanel/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import parseBody from "@/util/parseBody/index.js";
import scan from "@/util/scan/index.js";
import findPrimaryIntent from "@/cli/findPrimaryIntent/index.js";

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
 * to TreePanel and DetailPanel. Handles all keyboard input.
 */
export default function App({ root, initialNodes }: AppProps): React.ReactElement {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const columns = stdout?.columns ?? 80;

	// --- Tree state ---
	// Cache shallow results so toggling back from deep view restores them instantly.
	const [shallowNodes] = useState<TreeNode[]>(initialNodes);
	const [treeNodes, setTreeNodes] = useState<TreeNode[]>(initialNodes);
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
	const [cursorIndex, setCursorIndex] = useState(0);
	const [searchFilter, setSearchFilter] = useState("");
	const [isDeepView, setIsDeepView] = useState(false);
	const [deepLoading, setDeepLoading] = useState(false);

	// Derive flatNodes from treeNodes + expandedDirs — always in sync within the same render.
	const flatNodes: FlatNode[] = useMemo(
		() => flattenTree(treeNodes, expandedDirs),
		[treeNodes, expandedDirs],
	);

	// --- View mode ---
	const [mode, setMode] = useState<Mode>("tree");

	// --- Drill-in state ---
	const [drilledFile, setDrilledFile] = useState<AideFile | null>(null);
	const [drillData, setDrillData] = useState<DrillData | null>(null);
	const [drillCache] = useState<Map<string, DrillData>>(new Map());
	// Single expanded section in drill-in mode; Tab cycles through sections.
	const [expandedSection, setExpandedSection] = useState<number | null>(null);

	// --- Detail panel frontmatter (for currently selected file) ---
	const [selectedFrontmatter, setSelectedFrontmatter] = useState<AideFrontmatter | null>(null);
	const [fmCache] = useState<Map<string, AideFrontmatter | null>>(new Map());

	/** Returns true if any file descendant of node matches the search filter. */
	function hasMatchingDescendant(node: TreeNode, filter: string): boolean {
		if (node.kind === "file") {
			const lower = filter.toLowerCase();
			return (
				node.file.relativePath.toLowerCase().includes(lower) ||
				(node.file.summary ?? "").toLowerCase().includes(lower)
			);
		}
		return node.children.some((child) => hasMatchingDescendant(child, filter));
	}

	// Compute visible flat nodes from a single source of truth in App.
	// Dir nodes are included when at least one of their file descendants matches.
	// File nodes inside expanded dirs are included when they individually match.
	const visibleNodes: FlatNode[] = searchFilter
		? flatNodes.filter((fn) => {
			if (fn.node.kind === "dir") {
				return hasMatchingDescendant(fn.node, searchFilter);
			}
			return (
				fn.node.file.relativePath.toLowerCase().includes(searchFilter.toLowerCase()) ||
				(fn.node.file.summary ?? "").toLowerCase().includes(searchFilter.toLowerCase())
			);
		  })
		: flatNodes;

	// Clamp cursor within visible range.
	const clampedCursor = Math.min(cursorIndex, Math.max(0, visibleNodes.length - 1));

	// Current cursor node.
	const cursorNode = visibleNodes[clampedCursor];

	// Derive selectedFile: for dir nodes auto-load primary intent; for file nodes use directly.
	const selectedFile: AideFile | null = cursorNode
		? cursorNode.node.kind === "file"
			? cursorNode.node.file
			: findPrimaryIntent(cursorNode.node)
		: null;

	// Computed booleans for the cursor's current position.
	const cursorOnDir = cursorNode?.node.kind === "dir";
	const cursorDirExpanded = cursorOnDir && cursorNode.node.kind === "dir" && expandedDirs.has(cursorNode.node.path);

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
		setExpandedSection(null);
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
			setIsDeepView(false);
			return;
		}
		setDeepLoading(true);
		try {
			const result = await scan(root, undefined, false);
			const nodes = buildTreeData(result.files);
			setTreeNodes(nodes);
		} catch {
			// Silently keep current state on scan failure.
		} finally {
			setDeepLoading(false);
			setIsDeepView(true);
		}
	}, [isDeepView, root, shallowNodes]);

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
				if (!cursorNode) return;
				if (cursorNode.node.kind === "dir") {
					const dirPath = cursorNode.node.path;
					const isExpanded = expandedDirs.has(dirPath);
					setExpandedDirs((prev) => {
						const next = new Set(prev);
						if (isExpanded) {
							next.delete(dirPath);
						} else {
							next.add(dirPath);
						}
						return next;
					});
					// When expanding, advance cursor to first child.
					if (!isExpanded) {
						setCursorIndex((c) => c + 1);
					}
					// When collapsing, cursor stays on the dir node (clampedCursor handles bounds).
				} else {
					// File node: drill in.
					drillIntoFile(cursorNode.node.file);
				}
				return;
			}
			if (key.tab) {
				toggleDeepView();
				return;
			}
			if (key.escape) {
				// Priority 1: if cursor is on a file node inside an expanded dir, collapse parent.
				if (cursorNode && cursorNode.node.kind === "file") {
					// Walk backward through visibleNodes to find the nearest preceding dir at shallower depth.
					const cursorDepth = cursorNode.depth;
					for (let i = clampedCursor - 1; i >= 0; i--) {
						const candidate = visibleNodes[i];
						if (candidate.node.kind === "dir" && candidate.depth < cursorDepth) {
							// Collapse this parent dir.
							const parentPath = candidate.node.path;
							setExpandedDirs((prev) => {
								const next = new Set(prev);
								next.delete(parentPath);
								return next;
							});
							setCursorIndex(i);
							return;
						}
					}
				}
				// Priority 2: if search filter non-empty, clear it.
				if (searchFilter) {
					setSearchFilter("");
					setCursorIndex(0);
					return;
				}
				// Priority 3: exit.
				exit();
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

		if (key.upArrow) {
			const next = Math.max(0, clampedCursor - 1);
			setCursorIndex(next);
			const nextNode = visibleNodes[next];
			const nextFile = nextNode
				? nextNode.node.kind === "file"
					? nextNode.node.file
					: findPrimaryIntent(nextNode.node)
				: null;
			if (nextFile) drillIntoFile(nextFile);
			return;
		}
		if (key.downArrow) {
			const next = Math.min(visibleNodes.length - 1, clampedCursor + 1);
			setCursorIndex(next);
			const nextNode = visibleNodes[next];
			const nextFile = nextNode
				? nextNode.node.kind === "file"
					? nextNode.node.file
					: findPrimaryIntent(nextNode.node)
				: null;
			if (nextFile) drillIntoFile(nextFile);
			return;
		}
		if (key.tab) {
			const sectionCount = (drillData?.sections ?? []).filter((s) => s.heading !== "").length;
			if (sectionCount === 0) return;
			setExpandedSection((prev) => {
				if (prev === null) return 0;
				if (prev >= sectionCount - 1) return null;
				return prev + 1;
			});
			return;
		}
		if (input === "e" && drilledFile) {
			const editor = process.env.VISUAL ?? process.env.EDITOR ?? "code";
			spawnSync(editor, [drilledFile.path], { stdio: "inherit" });
			return;
		}
		// Enter is a no-op in drill-in mode.
	});

	// --- Layout ---
	const treeWidth = Math.floor(columns * 0.38);

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
					expandedDirs={expandedDirs}
					cursorOnDir={cursorOnDir}
					cursorDirExpanded={cursorDirExpanded}
					width={treeWidth - 2}
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
				<DetailPanel
					file={selectedFile}
					frontmatter={mode === "drill-in" ? (drillData?.frontmatter ?? null) : selectedFrontmatter}
					mode={mode === "drill-in" ? "drill-in" : "preview"}
					sections={drillData?.sections ?? []}
					expandedSection={expandedSection}
					drilledFilePath={drilledFile?.relativePath ?? null}
				/>
			</Box>
		</Box>
	);
}
