import aidePackage from "@/service/install/shared/aidePackage/index.js";

/**
 * The usage block `view --help` prints and a bad argument list is followed by. Built from the
 * package constants so the global and local launcher forms match the sync help.
 */
export default function formatUsage(): string {
	return (
		`Usage: ${aidePackage.command} view [--port <n>] [--brain <path>] (global)\n` +
		`       npx -y ${aidePackage.name}@<version> view [--port <n>] [--brain <path>] (local)\n\n` +
		"Starts the observer (one per machine, serving every project) on 127.0.0.1,\n" +
		"or reuses the one already running, and prints a link to this project's\n" +
		"newest session (the home view if it has none). A newly started observer\n" +
		"serves until Ctrl+C.\n" +
		"--port <n> overrides AIDE_OBSERVER_PORT, which overrides the default 24680.\n" +
		"--brain <path> overrides the brain folder this project's board is read from,\n" +
		"when this command starts the observer.\n\n" +
		"Exit codes: 0 stopped or already running, 1 not started or not replaced, 2 usage.\n"
	);
}
