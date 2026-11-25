/**
 * Resolves the project root a hook call belongs to: `CLAUDE_PROJECT_DIR` when
 * set and non-blank, else the hook input's `cwd`, else null (brief commitment
 * #89). The env var wins so presence lands under the same project key the aide
 * server records under, even after the agent `cd`s elsewhere.
 */
export default function resolveHookRoot({ env, cwd }: { env: NodeJS.ProcessEnv; cwd: string | undefined }): string | null {
	const fromEnv = env.CLAUDE_PROJECT_DIR;
	if (fromEnv !== undefined && fromEnv.trim() !== "") return fromEnv;
	if (cwd !== undefined && cwd.trim() !== "") return cwd;
	return null;
}
