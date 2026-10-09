import { createInterface } from "node:readline/promises";

/**
 * Asks whether to run the global install now. Defaults to No: the install runs
 * only on the user's explicit OK, and an Enter keypress is not one. Only `y` /
 * `yes` (case-insensitive) confirm. Only called when stdin and stdout are a
 * terminal.
 */
export default async function confirmGlobalInstall(
	packageName: string,
	installCommand: string,
): Promise<boolean> {
	process.stdout.write(`${packageName} is not installed globally.\n`);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = (await rl.question(`Install it now with \`${installCommand}\`? [y/N]: `))
			.trim()
			.toLowerCase();
		return answer === "y" || answer === "yes";
	} finally {
		rl.close();
	}
}
