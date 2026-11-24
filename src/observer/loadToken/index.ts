import { link, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import mintToken from "../mintToken/index.js";
import readStored from "./readStored/index.js";
import writeTemp from "./writeTemp/index.js";

const TOKEN_FILE = "observer-token";

/**
 * Returns the one per-user observer token, kept in `<root>/observer-token` so a restart or a version
 * replace reuses it and every open page and printed link stays valid. A file holding 64 lowercase hex
 * characters (trailing newline trimmed) is returned as it is. A missing file gets a fresh token, created
 * exclusively with mode 0600; when another start created it first, that start's value is returned, so two
 * concurrent first starts never produce two tokens. Any other content is replaced with a fresh token.
 * The token is written to a temp file first and published whole (hard link for the exclusive create,
 * rename for the replace), so a concurrent reader never sees a half-written file. Other fs errors throw.
 */
export default async function loadToken({ root }: { root: string }): Promise<string> {
	const file = join(root, TOKEN_FILE);

	const stored = await readStored({ file });
	if (stored !== null) return stored;

	const token = mintToken();
	const temp = await writeTemp({ file, token });
	try {
		try {
			await link(temp, file);
			return token;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}

		// The file exists. A valid one was written whole by a start that won the race: that is the one token.
		const winner = await readStored({ file });
		if (winner !== null) return winner;

		// Present but not a valid token: replace it.
		await rename(temp, file);
		return token;
	} finally {
		await unlink(temp).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}
