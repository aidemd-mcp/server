import type { RunningObserver } from "@/observer/types/index.js";

/** What starting the observer answered; `formatReply` turns it into the one line the skill branches on. */
export type StartReply =
	| { outcome: "started"; link: string; replaced?: string }
	| { outcome: "running"; link: string }
	| { outcome: "stuck"; runningVersion: string; ownVersion: string; link: string }
	| { outcome: "not-started"; reason: string };

/** How waiting for the freshly spawned observer ended. */
export type AwaitOutcome =
	| { outcome: "answered"; observer: RunningObserver }
	| { outcome: "not-started"; reason: string };
