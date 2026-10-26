import { readFile, writeFile } from "node:fs/promises";
import type { McpPinMove, UpgradeFileResult } from "@/types/index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import readAidePin from "../../shared/readAidePin/index.js";
import locatePinToken from "./locatePinToken/index.js";
import changesOnlyThePin from "./changesOnlyThePin/index.js";

const CHANGED_SINCE_CHECK =
	"The aide entry's version pin changed after it was checked, so it was not moved. Run aide_upgrade again to see the current pin before moving it.";

const NOT_BYTE_SAFE = (to: string) =>
	`The MCP config could not be edited byte-safely, so the aide entry's pin was not moved to ${to} and nothing was written. Tell the user the entry is unchanged.`;

/**
 * Writes the aide entry's version-pin move for the mcp category call. The tool,
 * not the agent, writes the move: only the bytes of the package-spec token change
 * (`@aidemd-mcp/server@<from>` becomes `@aidemd-mcp/server@<to>`), so indentation,
 * key order, line endings and every other server stay as they were. The move is
 * re-derived from the file as it is now and refused if the pin is no longer the
 * one detection reported. A refusal returns the file with `instructions` and
 * status left `"differs"`, and writes nothing. The new pin takes effect only in
 * a new session.
 */
export default async function movePin(
	file: UpgradeFileResult & { pinMove: McpPinMove },
): Promise<UpgradeFileResult> {
	const notByteSafe = { ...file, instructions: NOT_BYTE_SAFE(file.pinMove.to) };

	// Read the config as it is now, not as detection saw it
	let raw: string;
	try {
		raw = await readFile(file.filePath, "utf-8");
	} catch {
		return notByteSafe;
	}

	// Re-derive the pin; refuse if it is no longer the one detection reported
	let parsed: any;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return notByteSafe;
	}
	if (typeof parsed !== "object" || parsed === null) return notByteSafe;

	const pin = readAidePin(parsed.mcpServers?.aide);
	if (pin === null || pin.version !== file.pinMove.from) {
		return { ...file, instructions: CHANGED_SINCE_CHECK };
	}

	// Locate the exact bytes of the spec token, and confirm it is the arg the parse saw
	const token = locatePinToken({ raw, specIndex: pin.specIndex });
	if (token === null || token.value !== parsed.mcpServers.aide.args[pin.specIndex]) {
		return notByteSafe;
	}

	// Splice the new spec over the old token; JSON.stringify yields a valid JSON string token
	const spec = `${aidePackage.name}@${file.pinMove.to}`;
	const text = raw.slice(0, token.start) + JSON.stringify(spec) + raw.slice(token.end);

	// Last guard: the edited text must differ from the old config in the pin alone
	if (!changesOnlyThePin({ before: raw, after: text, specIndex: pin.specIndex, spec })) {
		return notByteSafe;
	}

	await writeFile(file.filePath, text, "utf-8");
	return { ...file, status: "updated" };
}
