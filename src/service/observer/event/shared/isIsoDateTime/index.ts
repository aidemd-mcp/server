/**
 * Calendar date with month lengths and the leap-year rule, the same pattern zod 3 builds
 * its date-time check from (`dateRegexSource` in zod/v3/types.js).
 */
const DATE_SOURCE =
	/((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))/
		.source;

/** Time of day: `HH:MM`, optional `:SS`, optional fraction of one or more digits. */
const TIME_SOURCE = /([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?/.source;

const ISO_DATE_TIME = new RegExp(`^${DATE_SOURCE}T${TIME_SOURCE}Z$`);

/**
 * True exactly when zod 3's default `z.string().datetime()` accepts the string: a valid
 * calendar date, `T`, `HH:MM` with optional seconds and fraction, then a capital `Z`, with
 * no offset and nothing around it. Written by hand so the hook's presence and ended-mark
 * contracts check a timestamp without loading zod (brief commitments #103, #150).
 */
export default function isIsoDateTime(value: string): boolean {
	return ISO_DATE_TIME.test(value);
}
