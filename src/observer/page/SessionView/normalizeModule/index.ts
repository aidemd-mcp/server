import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";

/**
 * A module or file path as an event recorded it (absolute, `./`-prefixed, backslashes, trailing
 * slash) in the project-relative POSIX form the status's tree uses; the project root is `ROOT_FOLDER`.
 * Pure text: a path outside the project root comes back as written, slash-normalised.
 */
export default function normalizeModule({ projectRoot, module }: { projectRoot: string; module: string }): string {
	let text = module.replace(/\\/g, "/");
	const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
	if (root !== "") {
		const folded = /^[a-z]:\//i.test(root);
		const left = folded ? text.toLowerCase() : text;
		const right = folded ? root.toLowerCase() : root;
		if (left === right || left.startsWith(`${right}/`)) text = text.slice(root.length);
	}
	text = text.replace(/^(\.\/)+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
	return text === "" ? ROOT_FOLDER : text;
}
