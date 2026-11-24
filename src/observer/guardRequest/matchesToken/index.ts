import { timingSafeEqual } from "node:crypto";

/** Compares two strings in constant time; strings of different length never match. */
export default function matchesToken({ given, expected }: { given: string; expected: string }): boolean {
	const givenBuffer = Buffer.from(given);
	const expectedBuffer = Buffer.from(expected);
	if (givenBuffer.length !== expectedBuffer.length) return false;
	return timingSafeEqual(givenBuffer, expectedBuffer);
}
