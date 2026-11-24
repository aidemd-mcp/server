import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import startObserver from "@/observer/index.js";
import buildViewLink from "@/observer/buildViewLink/index.js";
import seedFixtures from "@/observer/seedFixtures/index.js";
import locatePageAssets from "@/observer/locatePageAssets/index.js";
import pageAssets from "@/observer/shared/pageAssets/index.js";
import describeError from "@/util/describeError/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import parseArgs from "./parseArgs/index.js";
import refuse from "./refuse/index.js";
import waitForSignal from "./waitForSignal/index.js";

/**
 * Runs an observer on a test port over throwaway app data, for QA. Creates two temp folders (app
 * data and project work), points the per-user app-data lookup at the first so the user's real
 * observer and logs are never touched, seeds every fixture scenario of the chosen `--set` unless `--empty`, starts the
 * observer, prints the home link and one session link per scenario, then waits for Ctrl+C (or the
 * observer's own stop), stops it and removes both folders.
 */
export default async function seedObserver(): Promise<void> {
	const { port, empty, set } = parseArgs({ args: process.argv.slice(2) });
	if (!existsSync(join(locatePageAssets(), pageAssets.script))) refuse({ message: "Run npm run build first.", code: 1 });

	const appDataFolder = await mkdtemp(join(tmpdir(), "aide-observer-qa-appdata-"));
	const workDir = await mkdtemp(join(tmpdir(), "aide-observer-qa-work-"));
	let exitCode = 0;

	try {
		process.env.LOCALAPPDATA = appDataFolder;
		process.env.XDG_STATE_HOME = appDataFolder;
		if (platform() === "darwin") process.env.HOME = appDataFolder;

		const { root: appDataRoot } = resolveRoot();
		const inside = relative(appDataFolder, appDataRoot);
		if (inside.startsWith("..") || isAbsolute(inside))
			throw new Error(`The app-data root "${appDataRoot}" is outside the temp folder "${appDataFolder}"; refusing to touch it.`);

		const seeded = empty ? { scenarios: [] } : await seedFixtures({ appDataRoot, workDir, now: Date.now(), set });

		const started = await startObserver({ port });
		if (started.outcome !== "started") {
			const reason = started.outcome === "not-started" ? started.reason : `an observer already runs at ${started.observer.address}`;
			throw new Error(`Observer not started (${started.outcome}): ${reason}`);
		}

		console.log(`Home: ${buildViewLink({ observer: started.observer })}`);
		for (const { id, label, projectKey, sessionIds } of seeded.scenarios) {
			const newest = [...sessionIds].sort().at(-1);
			if (newest === undefined) continue;
			console.log(`${id} — ${label}: ${buildViewLink({ observer: started.observer, view: { projectKey, sessionId: newest } })}`);
		}

		await Promise.race([waitForSignal(), started.stopped]);
		await started.stop();
	} catch (error) {
		console.error(describeError({ error }));
		exitCode = 1;
	} finally {
		await rm(appDataFolder, { recursive: true, force: true });
		await rm(workDir, { recursive: true, force: true });
	}

	process.exit(exitCode);
}

await seedObserver();
