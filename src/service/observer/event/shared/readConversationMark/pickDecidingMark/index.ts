import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";

/**
 * The mark that decides a conversation's end (brief commitments #118, #132),
 * pure: null for none; any `user` mark wins (the newest `endedAt` among them,
 * ended by approval never reopens); otherwise the newest `endedAt` of all. A
 * tie keeps the earlier entry.
 */
export default function pickDecidingMark({ marks }: { marks: EndedMark[] }): EndedMark | null {
	const newest = (candidates: EndedMark[]): EndedMark | null =>
		candidates.reduce<EndedMark | null>(
			(best, candidate) =>
				best === null || Date.parse(candidate.endedAt) > Date.parse(best.endedAt) ? candidate : best,
			null,
		);

	return newest(marks.filter((mark) => mark.endedBy === "user")) ?? newest(marks);
}
