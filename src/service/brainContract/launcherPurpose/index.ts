/**
 * The launcher's one-line purpose, as aide_brain's template read reports it.
 * The launcher is the config's frontmatter, not a body section, so it has no
 * marker, role or entry in the `brainContract` array and is not part of the
 * required-section list the parser enforces.
 */
const launcherPurpose: string =
	"Frontmatter that names the brain and holds the launcher (command and args) sync writes into the project's MCP config to start the brain's MCP server.";

export default launcherPurpose;
