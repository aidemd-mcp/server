/**
 * R10 (brief #17): the refusal text for a change whose spliced result would not parse as a valid
 * brain config. Single-sourced so the insertion and the guarded apply tell the agent the same thing.
 */
export default function invalidResultInstructions(): string {
	return "Applying this change would not leave a valid brain config, so nothing was written. Re-check brain state with `aide_info`.";
}
