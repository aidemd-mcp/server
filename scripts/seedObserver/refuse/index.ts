/** Prints a refusal line and ends the process; nothing has been created yet when this is used. */
export default function refuse({ message, code }: { message: string; code: number }): never {
	console.error(message);
	process.exit(code);
}
