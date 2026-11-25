import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Test safety net: every test process gets its own throwaway per-user AIDE root.
 *
 * AIDEMD_HOME overrides the per-user root on every OS, and while it is set the one-time move from
 * the old Windows location never runs. A test that does not stub it therefore can never read,
 * write or move the user's real `%USERPROFILE%\.aidemd` (or old `%LOCALAPPDATA%\aidemd`).
 * Tests that need their own root still stub AIDEMD_HOME themselves.
 */
if (!process.env.AIDEMD_HOME) {
	process.env.AIDEMD_HOME = join(mkdtempSync(join(tmpdir(), "aide-test-home-")), "aidemd");
}
