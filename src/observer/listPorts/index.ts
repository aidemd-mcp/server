import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * The ports a start tries, in order (brief commitment #98): the preferred port first, then
 * `protocol.ports` in their listed order, each port once. The preferred port is the replaced
 * observer's port, else the resolved head of the list, so an address a user already holds is
 * the first one tried.
 */
export default function listPorts({ preferred }: { preferred: number }): number[] {
	return [...new Set([preferred, ...protocol.ports])];
}
