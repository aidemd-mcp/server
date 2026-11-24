import { HASH_SUFFIX } from "../shared/projectKeyHash/index.js";

const MAX_LENGTH = 255;
const UNSAFE_CHARACTER = /[/\\\0]/;

/**
 * True when `value` is one safe path segment shaped like a project key
 * (`<project folder name>-<6 lowercase hex>`). Every caller runs this before a
 * key from outside (a URL, a post header, a folder name) reaches a path, so no
 * outside value can escape the app-data root.
 */
export default function isProjectKey(value: string): boolean {
	if (value === "" || value.length > MAX_LENGTH) return false;
	if (UNSAFE_CHARACTER.test(value)) return false;
	if (value.startsWith(".")) return false;
	return HASH_SUFFIX.test(value);
}
