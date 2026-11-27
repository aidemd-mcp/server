/**
 * Type guard for a closed object: a non-null, non-array object whose every own enumerable
 * key is one of `keys`, the rule of zod 3's `.strict()`. It checks no values; the caller
 * checks each field. `Object.keys` counts a `__proto__` key that `JSON.parse` produced, so
 * such a key is rejected like any other extra key. Positional parameters, because a type
 * predicate cannot name a destructured parameter.
 */
export default function isClosedRecord(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.keys(value).every((key) => keys.includes(key));
}
