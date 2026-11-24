import { writeFile } from "node:fs/promises";
import mintToken from "../../mintToken/index.js";

/** Writes the token to a private temp file beside the target (exclusive, mode 0600) and returns its path. */
export default async function writeTemp({ file, token }: { file: string; token: string }): Promise<string> {
	const temp = `${file}.${process.pid}.${mintToken().slice(0, 8)}.tmp`;
	await writeFile(temp, `${token}\n`, { flag: "wx", mode: 0o600 });
	return temp;
}
