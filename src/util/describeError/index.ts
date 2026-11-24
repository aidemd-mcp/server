/**
 * The one shared answer to "what message does this thrown value carry": an
 * Error's message, or the thrown value as a string. Pure: no fs access.
 */
export default function describeError({ error }: { error: unknown }): string {
	return error instanceof Error ? error.message : String(error);
}
