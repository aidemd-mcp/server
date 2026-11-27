import { applyEdits, modify, type JSONPath } from "jsonc-parser";
import isAideHookCommand from "../isAideHookCommand/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a hook element is a `type: "command"` hook whose command is AIDE's. */
const isAideHook = (hook: unknown): boolean =>
	isRecord(hook) && hook.type === "command" && typeof hook.command === "string" && isAideHookCommand(hook.command);

/**
 * Removes the node at `path` with `jsonc-parser`, keeping the whitespace that
 * leads into a first element. The library removes a first property or element
 * from just after its opening bracket through the start of the next sibling,
 * which would pull that sibling up onto the bracket's line and drop its indent.
 * Narrowing the edit to start at the node itself leaves the sibling where the
 * user put it.
 */
function removeNode({ text, path }: { text: string; path: JSONPath }): string {
	const [edit] = modify(text, path, undefined, {});
	const leading = /^\s*/.exec(text.slice(edit.offset, edit.offset + edit.length))?.[0].length ?? 0;
	const end = edit.offset + edit.length;
	const closesParent = /^\s*[}\]]/.test(text.slice(end));
	if (leading === 0 || closesParent) return applyEdits(text, [edit]);
	return applyEdits(text, [{ offset: edit.offset + leading, length: edit.length - leading, content: "" }]);
}

/**
 * The removal paths for one event's matcher groups, in descending index order so
 * each removal leaves the paths still to come valid. A group made only of AIDE
 * hooks goes whole; a mixed group loses just AIDE's elements. `emptied` is true
 * when every group of the array went, so the caller removes the event key instead.
 */
function planEvent({ event, groups }: { event: string; groups: unknown[] }): { paths: JSONPath[]; emptied: boolean } {
	const paths: JSONPath[] = [];
	let removedGroups = 0;
	for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex--) {
		const group = groups[groupIndex];
		if (!isRecord(group) || !Array.isArray(group.hooks)) continue;
		const aideIndexes = group.hooks.flatMap((hook, index) => (isAideHook(hook) ? [index] : []));
		if (aideIndexes.length === 0) continue;
		if (aideIndexes.length === group.hooks.length) {
			paths.push(["hooks", event, groupIndex]);
			removedGroups++;
			continue;
		}
		for (const index of aideIndexes.reverse()) paths.push(["hooks", event, groupIndex, "hooks", index]);
	}
	return { paths, emptied: removedGroups > 0 && removedGroups === groups.length };
}

/**
 * Removes AIDE's hook entries from a Claude Code settings file and returns the
 * new text, byte-identical when nothing in it is AIDE's.
 *
 * `text` is the file, `settings` its parsed root (from `parseSettings`) and
 * `events` optionally limits which `hooks.<event>` keys are touched (absent means
 * every key). Only containers AIDE's removal emptied go with it: the matcher
 * group, then the event key, then the `hooks` key. A container that was already
 * empty, a non-array event value, a non-command hook and every other key keep
 * their bytes. Removals are `jsonc-parser` edits, so indentation, comments and
 * line endings outside the removed ranges are the user's own.
 */
export default function removeAideHooks({
	text,
	settings,
	events,
}: {
	text: string;
	settings: Record<string, unknown>;
	events?: ReadonlySet<string>;
}): string {
	const { hooks } = settings;
	if (!isRecord(hooks)) return text;

	const targeted = Object.keys(hooks).filter((event) => events === undefined || events.has(event));
	const removals = targeted.flatMap((event) => {
		const groups = hooks[event];
		if (!Array.isArray(groups)) return [];
		const { paths, emptied } = planEvent({ event, groups });
		if (paths.length === 0) return [];
		return [{ event, paths: emptied ? [["hooks", event] as JSONPath] : paths, emptied }];
	});
	if (removals.length === 0) return text;

	// Removing the last surviving key of `hooks` removes `hooks` itself.
	const emptiedEvents = removals.filter(({ emptied }) => emptied).length;
	const paths: JSONPath[] =
		emptiedEvents === Object.keys(hooks).length ? [["hooks"]] : removals.flatMap(({ paths: eventPaths }) => eventPaths);

	let result = text;
	for (const path of paths) result = removeNode({ text: result, path });
	return result;
}
