#!/usr/bin/env node
/**
 * Bump version, sync server.json, commit, tag, and push.
 * CI handles npm publish + MCP Registry publish.
 *
 * Usage: node scripts/publish.mjs <patch|minor|major> [message]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bump = process.argv[2];

const message = process.argv.slice(3).join(" ");

if (!["patch", "minor", "major"].includes(bump)) {
	console.error("Usage: node scripts/publish.mjs <patch|minor|major> [message]");
	process.exit(1);
}

// Bump package.json version (npm version doesn't commit/tag by default with --no-git-tag-version)
execSync(`npm version ${bump} --no-git-tag-version`, { cwd: root, stdio: "inherit" });

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const version = pkg.version;

// Sync server.json
const serverJsonPath = resolve(root, "server.json");
const serverJson = JSON.parse(readFileSync(serverJsonPath, "utf-8"));
serverJson.version = version;
for (const p of serverJson.packages ?? []) {
	p.version = version;
}
writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + "\n");

// Commit, tag, push
execSync(`git add package.json server.json`, { cwd: root, stdio: "inherit" });
const commitMsg = message ? `${version}: ${message}` : version;
execSync(`git commit -m "${commitMsg}"`, { cwd: root, stdio: "inherit" });
execSync(`git tag v${version}`, { cwd: root, stdio: "inherit" });
execSync(`git push && git push origin v${version}`, { cwd: root, stdio: "inherit" });

console.log(`\nv${version} tagged and pushed — CI will publish to npm + MCP Registry`);
