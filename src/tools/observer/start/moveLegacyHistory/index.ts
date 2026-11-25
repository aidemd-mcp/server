import moveLegacyRoot from "@/util/runtimePaths/moveLegacyRoot/index.js";
import describeError from "@/util/describeError/index.js";

const writeStderrLine = (line: string): void => {
	process.stderr.write(line);
};

/**
 * Carries the calling process's old per-user folder history into the current per-user root, once,
 * best effort (brief commitment #107). Never throws and never changes what the start answers: a
 * clean move, or nothing to move, writes nothing; files left in place write one `aide: ` line
 * naming each path and why; a failure writes one `aide: ` line with the error. `write` receives
 * each line with its trailing newline and defaults to stderr.
 */
export default async function moveLegacyHistory({
	write = writeStderrLine,
}: { write?: (line: string) => void } = {}): Promise<void> {
	try {
		const result = await moveLegacyRoot();
		if (result.outcome === "none" || result.left.length === 0) return;
		const left = result.left
			.map(({ path, reason, detail }) => `${path} (${reason}${detail === undefined ? "" : `: ${detail}`})`)
			.join(", ");
		write(
			`aide: moved ${result.moved} runtime file(s) from ${result.legacyRoot} to the per-user folder; ${result.left.length} left in place: ${left}\n`,
		);
	} catch (error) {
		write(`aide: could not move runtime files from the old per-user folder: ${describeError({ error })}\n`);
	}
}
