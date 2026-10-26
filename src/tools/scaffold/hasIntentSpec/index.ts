/**
 * True when the file names hold an intent spec: `.aide` or `intent.aide`, the
 * two names scaffold itself writes for one. Every other .aide file
 * (research, plan, todo, brief, session) is not a spec, so a folder holding
 * only those has no contract for a plan to implement.
 */
export default function hasIntentSpec(existing: string[]): boolean {
	return existing.includes(".aide") || existing.includes("intent.aide");
}
