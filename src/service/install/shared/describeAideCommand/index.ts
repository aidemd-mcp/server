import aidePackage from "../aidePackage/index.js";

/**
 * Remediation prose names the user's own launcher instead of hardcoding npx or
 * `@latest`: the global bin when the project's `aide` MCP entry runs the
 * globally installed package, or the pinned npx form when it runs through npx.
 * `<version>` stays literal placeholder text because the user's entry may pin a
 * different version than the running server.
 *
 * @param subcommand - The AIDE CLI subcommand the prose tells the user to run.
 */
export default function describeAideCommand(subcommand: "init" | "sync"): string {
	return `\`${aidePackage.command} ${subcommand}\` when the project's \`aide\` MCP entry runs the globally installed \`${aidePackage.command}\`, or \`npx -y ${aidePackage.name}@<version> ${subcommand}\` with the version that entry pins when it runs through npx`;
}
