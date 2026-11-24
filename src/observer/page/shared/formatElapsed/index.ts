import formatSpan from "@/observer/page/shared/formatSpan/index.js";

/**
 * Formats a running or finished duration the way the handoff writes it (`45s`, `4m 12s`,
 * `1h 03m`). Negative and fractional input is clamped and floored by `formatSpan`.
 */
export default function formatElapsed(seconds: number): string {
	return formatSpan(seconds);
}
