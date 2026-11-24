import aidePackage from "@/service/install/shared/aidePackage/index.js";

/**
 * The command that installs AIDE in a project, in the handoff's `.av-cmd` box: `npx -y
 * @aidemd-mcp/server@latest init`, built from the package's own name so the page never types it by
 * hand. Home's empty state and a session view's not-installed notice both show it.
 */
export default function InstallCommand() {
	return <div className="av-cmd">{`npx -y ${aidePackage.name}@latest init`}</div>;
}
