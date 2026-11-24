/**
 * How many hex characters of the project-root hash close a project key. Pure values with no Node
 * imports, so the observer's browser page shares them with the server.
 */
export const HASH_LENGTH = 6;

/** Matches the `-<hash>` tail of a project key (`<project folder name>-<6 lowercase hex>`). */
export const HASH_SUFFIX = new RegExp(`-[0-9a-f]{${HASH_LENGTH}}$`);
