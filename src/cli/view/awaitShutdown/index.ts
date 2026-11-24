import describeError from "@/util/describeError/index.js";

const SIGNALS = ["SIGINT", "SIGTERM"] as const;

/**
 * Holds the foreground process until the observer ends, one of two ways. The first SIGINT or
 * SIGTERM runs `stop` and then resolves; or `stopped` settles first (a newer AIDE's shutdown
 * request ended the observer) and the command resolves at once without calling `stop` again. Either
 * way both signal listeners are removed, so a second signal while stopping neither calls `stop`
 * again nor is swallowed. A failing `stop` is reported on stderr and still resolves: the command is
 * ending either way.
 */
export default function awaitShutdown({
	stop,
	stopped,
}: {
	stop: () => Promise<void>;
	stopped: Promise<void>;
}): Promise<void> {
	return new Promise<void>((done) => {
		const removeListeners = () => {
			for (const signal of SIGNALS) process.removeListener(signal, onSignal);
		};

		const onSignal = () => {
			removeListeners();
			stop()
				.catch((error: unknown) => {
					process.stderr.write(`Error: ${describeError({ error })}\n`);
				})
				.then(done);
		};

		for (const signal of SIGNALS) process.on(signal, onSignal);

		void stopped.then(() => {
			removeListeners();
			done();
		});
	});
}
