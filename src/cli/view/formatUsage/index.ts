import aidePackage from "@/service/install/shared/aidePackage/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * The usage block `view --help` prints and a bad argument list is followed by. Built from the
 * package constants so the global and local launcher forms match the sync help, and the port range
 * is read from the protocol's port list so it never drifts from the ports the observer tries.
 */
export default function formatUsage(): string {
	const first = protocol.ports[0];
	const last = protocol.ports[protocol.ports.length - 1];
	return (
		`Usage: ${aidePackage.command} view [--port <n>] [--kanban <path>] (global)\n` +
		`       npx -y ${aidePackage.name}@<version> view [--port <n>] [--kanban <path>] (local)\n\n` +
		"Starts the observer (one per machine, serving every project) on 127.0.0.1,\n" +
		"or reuses the one already running, and prints a link to this project's\n" +
		"newest session (the home view if it has none). A newly started observer\n" +
		"serves until Ctrl+C.\n" +
		`--port <n> is tried first, else ${protocol.portEnvVar}, then ports ${first} to ${last}\n` +
		"in order; the first free one is used, and a line says so when it is not the one asked for.\n" +
		"--kanban <path> names the kanban folder (the folder holding one board folder per\n" +
		"project tag) this project's board is read from, instead of the kanban field of\n" +
		"the project's brain config, when this command starts the observer.\n" +
		"--brain <path> is deprecated and means --kanban <path>/kanban.\n\n" +
		"Exit codes: 0 stopped or already running, 1 not started (no port could be bound, or a bad port value) or not replaced, 2 usage.\n"
	);
}
