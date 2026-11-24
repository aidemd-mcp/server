/**
 * The one builder of a per-project API path, `/api/projects/<key>/<rest>`, so the key is encoded
 * in one place for every `fetch*` wrapper and `deleteSession`. `rest` arrives already encoded.
 */
export default function projectPath({ projectKey, rest }: { projectKey: string; rest: string }): string {
	return `/api/projects/${encodeURIComponent(projectKey)}/${rest}`;
}
