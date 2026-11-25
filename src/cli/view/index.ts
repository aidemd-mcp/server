import startObserver from "@/observer/index.js";
import resolvePort from "@/observer/resolvePort/index.js";
import buildObserverMessage from "@/observer/shared/buildObserverMessage/index.js";
import describeError from "@/util/describeError/index.js";
import readPackageVersion from "@/util/readPackageVersion/index.js";
import awaitShutdown from "./awaitShutdown/index.js";
import buildLink from "./buildLink/index.js";
import formatPortNote from "./formatPortNote/index.js";
import formatUsage from "./formatUsage/index.js";
import parseViewArgs from "./parseViewArgs/index.js";

const EXIT_OK = 0;
const EXIT_NOT_STARTED = 1;
const EXIT_USAGE = 2;

const BRAIN_NOTE =
	"Note: --brain applies only when this command starts the observer; the running observer keeps its own setting.\n";

/**
 * The `view` command: serves the one per-user observer in the foreground until Ctrl+C or until a
 * newer AIDE asks it to shut down. Recipe: parse the arguments (help and invalid input exit 2
 * without starting anything); choose the port (`--port`, else `AIDE_OBSERVER_PORT`, else the first
 * port of the list; an invalid value exits 1 naming it), which is only the first port tried: the
 * observer walks on through 24680 to 24689 when it is not free (brief #73); start the observer,
 * scoping `--brain` to this project only; then report by outcome. `kept` prints the running
 * observer's link (plus a note when `--brain` was given, since a kept observer keeps its own
 * setting) and exits 0; `stuck` (an older observer that did not shut down) names both versions and
 * the old observer's link and exits 1; `not-started` (no port on the list could be bound, naming
 * every port tried, or the start threw) prints the reason and exits 1; `started` prints the link,
 * serves until a signal or the observer's own `stopped`, and exits 0. `kept` and `started` also
 * print the port note when the observer is not on the port asked for. Every link opens the newest
 * session of the project this command ran from, else the home view. Never calls `process.exit`;
 * the dispatcher owns the exit. Writes nothing to the project.
 */
export default async function view({ args, projectRoot }: { args: string[]; projectRoot: string }): Promise<number> {
	// 1. Parse the arguments.
	const parsed = parseViewArgs({ args, cwd: projectRoot });
	if (parsed.kind === "help") {
		process.stdout.write(formatUsage());
		return EXIT_USAGE;
	}
	if (parsed.kind === "invalid") {
		process.stderr.write(`Error: ${parsed.message}\n${formatUsage()}`);
		return EXIT_USAGE;
	}

	// 2. Choose the port; an unusable value refuses the start by name.
	const choice = resolvePort({ flagPort: parsed.port });
	if (!choice.ok) {
		process.stderr.write(`${buildObserverMessage({ kind: "not-started", reason: choice.reason })}\n`);
		return EXIT_NOT_STARTED;
	}

	// 3. Start the observer; a throw is a start failure like a busy port. `--brain` is for this project only.
	const brainOverride = parsed.brainPath === undefined ? undefined : { projectRoot, brainPath: parsed.brainPath };
	let started: Awaited<ReturnType<typeof startObserver>>;
	try {
		started = await startObserver({ port: choice.port, ...(brainOverride !== undefined && { brainOverride }) });
	} catch (error: unknown) {
		process.stderr.write(`${buildObserverMessage({ kind: "not-started", reason: describeError({ error }) })}\n`);
		return EXIT_NOT_STARTED;
	}

	// 4. Not started (no port on the list could be bound): nothing was written.
	if (started.outcome === "not-started") {
		process.stderr.write(`${buildObserverMessage({ kind: "not-started", reason: started.reason })}\n`);
		return EXIT_NOT_STARTED;
	}

	// 5. The link opens the newest session of this project; a link that cannot be built (a runtime
	// folder inside the project) is a start failure, and an observer this command started is stopped.
	let link: string;
	try {
		link = await buildLink({ observer: started.observer, projectRoot });
	} catch (error: unknown) {
		if (started.outcome === "started") await started.stop();
		process.stderr.write(`${buildObserverMessage({ kind: "not-started", reason: describeError({ error }) })}\n`);
		return EXIT_NOT_STARTED;
	}

	// The observer's port may differ from the one asked for; say so, whatever the cause.
	const portNote = formatPortNote({ requested: choice.port, actual: started.observer.port });

	// 6. An observer already answers: report its link and leave it alone.
	if (started.outcome === "kept") {
		process.stdout.write(`${buildObserverMessage({ kind: "already-running", link })}\n`);
		if (portNote !== null) process.stdout.write(`${portNote}\n`);
		if (brainOverride !== undefined) process.stdout.write(BRAIN_NOTE);
		return EXIT_OK;
	}

	// 7. An older observer did not shut down: it still serves, this version did not replace it.
	if (started.outcome === "stuck") {
		process.stderr.write(
			`${buildObserverMessage({ kind: "stuck", runningVersion: started.observer.version, ownVersion: readPackageVersion(), link })}\n`,
		);
		return EXIT_NOT_STARTED;
	}

	// 8. Serve until a signal or the observer's own shutdown, then report.
	process.stdout.write(`${buildObserverMessage({ kind: "started", link, note: "Ctrl+C to stop" })}\n`);
	if (portNote !== null) process.stdout.write(`${portNote}\n`);
	await awaitShutdown({ stop: started.stop, stopped: started.stopped });
	process.stdout.write("Observer stopped\n");
	return EXIT_OK;
}
