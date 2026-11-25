import type { FileMove } from "../../types/index.js";
import describeError from "../../../describeError/index.js";
import compareFiles from "../compareFiles/index.js";
import publishCopy from "../publishCopy/index.js";
import isGone from "../shared/isGone/index.js";
import unlinkIfPresent from "../shared/unlinkIfPresent/index.js";

/**
 * Move one append-only log (an event log or an archived one) from the legacy root to `target`.
 * Compare first: a missing target gets an exclusive copy (when a concurrent mover won the
 * publish, compare again once); a target that is a byte prefix of the source is replaced by the
 * source; same or ahead needs no copy; diverged returns `left` with the source untouched. Then
 * release: compare once more, and only when the new root holds every byte of the source is the
 * source unlinked (`moved`, or `superseded` when nothing had to be copied); otherwise the source
 * stays for the next start (`left`/`changed`). A source another mover already took counts as
 * `superseded`. Any other error returns `left`/`error` and never removes the source.
 */
export default async function moveLog({ source, target }: { source: string; target: string }): Promise<FileMove> {
	try {
		let copied = false;
		let state = await compareFiles({ source, target });

		if (state === "missing") {
			if ((await publishCopy({ source, target, replace: false })) === "published") copied = true;
			else state = await compareFiles({ source, target });
		}

		if (!copied) {
			if (state === "diverged") return { outcome: "left", reason: "diverged" };
			if (state === "missing") return { outcome: "left", reason: "changed" };
			if (state === "target-behind") {
				await publishCopy({ source, target, replace: true });
				copied = true;
			}
		}

		const verified = await compareFiles({ source, target });
		if (verified !== "same" && verified !== "target-ahead") return { outcome: "left", reason: "changed" };

		await unlinkIfPresent({ file: source });
		return { outcome: copied ? "moved" : "superseded" };
	} catch (error) {
		if (await isGone({ file: source }).catch(() => false)) return { outcome: "superseded" };
		return { outcome: "left", reason: "error", detail: describeError({ error }) };
	}
}
