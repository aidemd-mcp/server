import type { GlobalPackageStatus } from "@/types/index.js";

/** The install is a setup step the consumer runs before writing the entry, so the step itself tells the agent; nothing is said when the package is already installed. */
export default function planInstallInstruction(globalPackage: GlobalPackageStatus): string | undefined {
	if (globalPackage.installed) return undefined;
	return `The aide server is not installed globally. Run \`${globalPackage.installCommand}\` via Bash before merging this prescription. If the install fails, tell the user and do not merge the entry.`;
}
