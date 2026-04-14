#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";

const require = createRequire(import.meta.url);
const cliPath = join(dirname(require.resolve("@aidemd-mcp/server")), "cli", "index.js");
execFileSync("node", [cliPath, ...process.argv.slice(2)], { stdio: "inherit" });
