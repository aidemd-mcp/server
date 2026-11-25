import { stat } from "node:fs/promises";

/**
 * The last-write time of a Claude session's transcript file, as an ISO string:
 * one of the three sources of a session's last activity (brief commitment
 * #96). `undefined` and any failure (missing file, no permission, not a file)
 * answer null; the transcript's content is never read.
 */
export default async function readTranscriptActivity({
	transcriptPath,
}: {
	transcriptPath: string | undefined;
}): Promise<string | null> {
	if (transcriptPath === undefined) return null;

	try {
		const { mtime } = await stat(transcriptPath);
		return mtime.toISOString();
	} catch {
		return null;
	}
}
