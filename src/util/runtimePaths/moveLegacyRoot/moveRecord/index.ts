import type { FileMove } from "../../types/index.js";
import describeError from "../../../describeError/index.js";
import publishCopy from "../publishCopy/index.js";
import isGone from "../shared/isGone/index.js";
import unlinkIfPresent from "../shared/unlinkIfPresent/index.js";

/**
 * Move one record written whole (a presence record or an ended mark) from the legacy root to
 * `target`. When the new root already holds the file it wins: the source is dropped
 * (`superseded`). Otherwise the record is published with an exclusive copy (when a concurrent
 * mover won the publish, the new root wins as well), then the source is unlinked (`moved`). A
 * source another mover already took counts as `superseded`. Any other error returns
 * `left`/`error` with the source untouched.
 */
export default async function moveRecord({ source, target }: { source: string; target: string }): Promise<FileMove> {
	try {
		const held = await isGone({ file: target }).then((gone) => !gone);
		if (held) {
			await unlinkIfPresent({ file: source });
			return { outcome: "superseded" };
		}

		const published = await publishCopy({ source, target, replace: false });
		await unlinkIfPresent({ file: source });
		return { outcome: published === "published" ? "moved" : "superseded" };
	} catch (error) {
		if (await isGone({ file: source }).catch(() => false)) return { outcome: "superseded" };
		return { outcome: "left", reason: "error", detail: describeError({ error }) };
	}
}
