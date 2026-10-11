import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";

/**
 * Returns the launcher example for a template read: the frontmatter region of the bundled
 * template in its default launch mode, from the start of the line after the opening `---`
 * fence line through the line break before the closing `---` fence (the first `\n---` after
 * the opening fence). No trim, no normalization, so the bytes match the region the upgrade
 * brain category previews as a launcher's `before` on an untouched template config.
 *
 * The slice runs only on the bundled template, which is package code; a missing fence means
 * the package itself is broken, so it throws instead of returning a made-up region.
 */
export default function readTemplateLauncher(): string {
	const template = obsidianBrainAideTemplate();

	const openFence = template.indexOf("---");
	if (openFence === -1) throw new Error("The bundled brain template has no opening frontmatter fence");

	const closeBreak = template.indexOf("\n---", openFence + 3);
	if (closeBreak === -1) throw new Error("The bundled brain template has no closing frontmatter fence");

	const yamlStart = template.indexOf("\n", openFence + 3) + 1;
	return template.slice(yamlStart, closeBreak + 1);
}
