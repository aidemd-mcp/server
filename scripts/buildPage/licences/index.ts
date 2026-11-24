/** The font licences the page bundle ships: each `source` file under node_modules is copied beside the bundle as `file`. */
const licences: readonly { source: string; file: string }[] = [
	{ source: "node_modules/@fontsource/jetbrains-mono/LICENSE", file: "JetBrainsMono-OFL.txt" },
	{ source: "node_modules/@fontsource/inter/LICENSE", file: "Inter-OFL.txt" },
];

export default licences;
