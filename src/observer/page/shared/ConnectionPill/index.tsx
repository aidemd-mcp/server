import type { ConnState } from "@/observer/page/types/index.js";

const WORDS: Record<ConnState, string> = { live: "Live", idle: "Idle", recon: "Reconnecting" };

/** The header's connection pill: a led plus the word, so the state never rests on colour alone. */
export default function ConnectionPill({ state }: { state: ConnState }) {
	return (
		<span className={`av-conn ${state}`}>
			<span className="led" aria-hidden="true" />
			{WORDS[state]}
		</span>
	);
}
