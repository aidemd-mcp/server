import type { NowCardModel } from "@/observer/page/types/index.js";

/**
 * What the current module's node says about it, read from the now card's kind: `Working now · <Phase>`
 * while a phase runs (the card's title is the phase's label), `Waiting on you` at a gate, `Last worked
 * on` when idle, and nothing before any activity.
 */
export default function pickCurrentLabel({ card }: { card: NowCardModel }): string | null {
	if (card.kind === "run" || card.kind === "fix") return `Working now · ${card.title}`;
	if (card.kind === "wait") return "Waiting on you";
	if (card.kind === "idle") return "Last worked on";
	return null;
}
