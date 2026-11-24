/** Parses JSON text, returning undefined when it is not valid JSON, so the caller can treat a corrupt file as absent. */
export default function parseJson(content: string): unknown {
	try {
		return JSON.parse(content);
	} catch {
		return undefined;
	}
}
