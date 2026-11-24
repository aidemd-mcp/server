import describeError from "@/util/describeError/index.js";
import type { ProjectView, StreamHub } from "../types/index.js";

/**
 * Creates the coalesced status pusher, one queue per project. For each project key at most one
 * rebuild runs and one more waits: a burst of pushes during a rebuild causes exactly one follow-up
 * rebuild, and a project's views are broadcast in rebuild order, so an older view never arrives
 * after a newer one. Different projects rebuild independently. The frame carries
 * `{ projectKey, view }` and is filtered to that project's stream clients. A rebuild that finds no
 * project (null) broadcasts nothing; a failed rebuild is logged to stderr and broadcasts nothing,
 * and the pending rebuild still runs.
 */
export default function createStatusPusher({
	rebuild,
	hub,
}: {
	rebuild: (projectKey: string) => Promise<ProjectView | null>;
	hub: StreamHub;
}): { push(projectKey: string): void } {
	const queues = new Map<string, { pending: boolean }>(); // a key is present exactly while its rebuild runs

	async function run(projectKey: string, queue: { pending: boolean }): Promise<void> {
		do {
			queue.pending = false;
			try {
				const view = await rebuild(projectKey);
				if (view !== null) hub.broadcast({ name: "status", data: { projectKey, view }, projectKey });
			} catch (error) {
				const message = describeError({ error });
				process.stderr.write(`observer: status rebuild failed: ${message}\n`);
			}
		} while (queue.pending);
		queues.delete(projectKey);
	}

	return {
		push(projectKey) {
			const queue = queues.get(projectKey);
			if (queue !== undefined) {
				queue.pending = true;
				return;
			}
			const created = { pending: false };
			queues.set(projectKey, created);
			void run(projectKey, created);
		},
	};
}
