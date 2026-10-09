/**
 * Single source of AIDE's npm package name, its global bin command, and the
 * global install command. Every launcher, remediation phrase and install offer
 * reads these instead of restating the strings. The version is deliberately not
 * here; see `readAidePackageVersion`.
 */
export default {
	name: "@aidemd-mcp/server",
	command: "aidemd-mcp",
	installCommand: "npm i -g @aidemd-mcp/server",
} as const;
