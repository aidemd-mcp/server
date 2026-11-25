import listPorts from "@/observer/listPorts/index.js";
import tryBind from "@/tools/observer/shared/tryBind/index.js";
import type { PortTry } from "../types/index.js";

/**
 * Pre-walks the start's port list (brief commitments #73, #98): `tryBind` on each port of
 * `listPorts({ preferred })` in order. The first bindable port is `free`; when none is, `exhausted`
 * carries every port with the reason it failed, in order, for the BLOCKED reply. Never throws.
 */
export default async function walkPorts({
	preferred,
}: {
	preferred: number;
}): Promise<{ kind: "free"; port: number } | { kind: "exhausted"; tried: PortTry[] }> {
	const tried: PortTry[] = [];
	for (const port of listPorts({ preferred })) {
		const bound = await tryBind(port);
		if (bound.ok) return { kind: "free", port };
		tried.push({ port, reason: bound.reason });
	}
	return { kind: "exhausted", tried };
}
