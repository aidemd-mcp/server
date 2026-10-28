import { readFile, writeFile } from "node:fs/promises";
import type { McpGlobalSwitch, UpgradeFileResult } from "@/types/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import normalizeLaunchedCommand from "@/service/install/shared/normalizeLaunchedCommand/index.js";
import locateLaunchTokens from "./locateLaunchTokens/index.js";
import changesOnlyTheLaunch from "./changesOnlyTheLaunch/index.js";

const NOT_INSTALLED = `${aidePackage.name} is not installed globally, so the aide entry was not switched and nothing was written. Run \`${aidePackage.installCommand}\`, confirm it succeeded, then call aide_upgrade with category "mcp" again.`;

const NOT_BYTE_SAFE =
	"The MCP config could not be edited byte-safely, so the aide entry was not switched and nothing was written. Tell the user the entry is unchanged.";

const CHANGED_SINCE_CHECK =
	"The aide entry changed after it was checked, so it was not switched. Run aide_upgrade again to see its current state.";

/**
 * Writes the aide entry's switch from npx to the global `aidemd-mcp` command for
 * the mcp category call. The tool, not the agent, writes the switch: only the
 * bytes of the entry's `command` token and `args` array change, so indentation,
 * key order, line endings, the entry's other fields and every other server stay
 * as they were, and the entry's key is never renamed. The install is re-checked
 * at write time (the detection-time `installed` flag is a hint, never the gate),
 * and the entry is re-derived from the file as it is now and refused if it is no
 * longer an npx launch. A refusal returns the file with `instructions` and status
 * left `"differs"`, and writes nothing. The switch takes effect only in a new
 * session.
 */
export default async function switchToGlobal(
	file: UpgradeFileResult & { globalSwitch: McpGlobalSwitch },
): Promise<UpgradeFileResult> {
	const { key } = file.globalSwitch;
	const notByteSafe = { ...file, instructions: NOT_BYTE_SAFE };

	// 1. The package must be installed globally now, not just when detection ran
	if (!(await checkGlobalPackage(aidePackage.name))) {
		return {
			...file,
			globalSwitch: { ...file.globalSwitch, installed: false },
			instructions: NOT_INSTALLED,
		};
	}

	// 2. Read the config as it is now, not as detection saw it
	let raw: string;
	let parsed: any;
	try {
		raw = await readFile(file.filePath, "utf-8");
		parsed = JSON.parse(raw);
	} catch {
		return notByteSafe;
	}
	if (typeof parsed !== "object" || parsed === null) return notByteSafe;

	// 3. Re-derive: the entry must still be an npx launch
	const entry = parsed.mcpServers?.[key];
	const launched =
		typeof entry === "object" && entry !== null
			? normalizeLaunchedCommand({ command: entry.command, args: entry.args })
			: null;
	if (launched?.token !== "npx") {
		return { ...file, instructions: CHANGED_SINCE_CHECK };
	}

	// 4. Locate the exact bytes of the command token and the args array
	const tokens = locateLaunchTokens({ raw, key });
	if (tokens === null) return notByteSafe;

	// 5. Splice the later range first so the earlier offsets stay valid
	const [first, second] =
		tokens.command.start < tokens.args.start
			? [
					{ range: tokens.command, text: JSON.stringify(aidePackage.command) },
					{ range: tokens.args, text: "[]" },
				]
			: [
					{ range: tokens.args, text: "[]" },
					{ range: tokens.command, text: JSON.stringify(aidePackage.command) },
				];
	const text =
		raw.slice(0, first.range.start) +
		first.text +
		raw.slice(first.range.end, second.range.start) +
		second.text +
		raw.slice(second.range.end);

	// 6. Last guard: the edited text must differ from the old config in the launch alone
	if (!changesOnlyTheLaunch({ before: raw, after: text, key })) return notByteSafe;

	// 7. Write
	await writeFile(file.filePath, text, "utf-8");
	return { ...file, status: "updated", globalSwitch: { ...file.globalSwitch, installed: true } };
}
