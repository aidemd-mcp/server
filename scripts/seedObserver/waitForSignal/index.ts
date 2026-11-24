/** Resolves when the process is asked to stop (Ctrl+C or a termination signal). */
export default function waitForSignal(): Promise<void> {
	return new Promise((done) => {
		process.once("SIGINT", () => done());
		process.once("SIGTERM", () => done());
	});
}
