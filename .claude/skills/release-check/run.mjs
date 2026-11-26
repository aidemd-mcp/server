#!/usr/bin/env node
// Pre-release end-to-end check for @aidemd-mcp/server.
//
// Packs exactly what `npm publish` would ship, installs it into a throwaway npm
// prefix, and exercises it in a fresh project with every per-user AIDE runtime
// file redirected to a temp app-data root. Never touches the real global npm
// install, the real observer, the real per-user app data or the real brain.
//
//   node .claude/skills/release-check/run.mjs [--keep] [--skip-build] [--no-claude]
//
// --keep        leave the temp root on disk (its path is always printed)
// --skip-build  reuse the current dist/ instead of running `npm run build`
// --no-claude   skip the headless `claude -p` runs (the simulated-agent checks still run)
//
// Dev tooling only: not part of the published package.

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse as parsePath, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const ARGS = new Set(process.argv.slice(2));
const KEEP = ARGS.has("--keep");
const SKIP_BUILD = ARGS.has("--skip-build");
const NO_CLAUDE = ARGS.has("--no-claude");

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const ROOT = join(tmpdir(), `aide-release-check-${STAMP}`);
const PREFIX = join(ROOT, "prefix");
const PACK_DIR = join(ROOT, "pack");
const AIDE_ROOT = join(ROOT, "aidemd-home"); // AIDEMD_HOME for every AIDE process the test starts
const VAULT = join(ROOT, "vault");
const PROJECT = join(ROOT, "rc-project");
const LOGS = join(ROOT, "logs");
const IS_WIN = process.platform === "win32";
const REAL_PORT = 24680;
const PKG = "@aidemd-mcp/server";
const PKG_DIR = IS_WIN ? join(PREFIX, "node_modules", ...PKG.split("/")) : join(PREFIX, "lib", "node_modules", ...PKG.split("/"));
const PREFIX_BIN = IS_WIN ? PREFIX : join(PREFIX, "bin");
const ENTRY = join(PKG_DIR, "dist", "index.js");
const HEADLESS_TIMEOUT_MS = 10 * 60 * 1000;

for (const dir of [ROOT, PREFIX, PACK_DIR, AIDE_ROOT, VAULT, PROJECT, LOGS]) mkdirSync(dir, { recursive: true });

// The real per-user AIDE root, resolved the way the product does, from this shell's env:
// AIDEMD_HOME when set, non-empty and absolute (every OS); else Windows <home>\.aidemd;
// macOS ~/Library/Application Support/aidemd; elsewhere $XDG_STATE_HOME (absolute) or
// ~/.local/state, plus /aidemd. Captured before anything is overridden.
const REAL_HOME = IS_WIN ? process.env.USERPROFILE || homedir() : homedir();
const SHELL_AIDEMD_HOME = process.env.AIDEMD_HOME ?? "";
const REAL_AIDE_ROOT =
	SHELL_AIDEMD_HOME.trim() !== "" && isAbsolute(SHELL_AIDEMD_HOME)
		? SHELL_AIDEMD_HOME
		: IS_WIN
			? join(REAL_HOME, ".aidemd")
			: process.platform === "darwin"
				? join(REAL_HOME, "Library", "Application Support", "aidemd")
				: join(process.env.XDG_STATE_HOME && isAbsolute(process.env.XDG_STATE_HOME) ? process.env.XDG_STATE_HOME : join(REAL_HOME, ".local", "state"), "aidemd");
// Windows only: the root versions before AIDEMD_HOME used (%LOCALAPPDATA%\aidemd), as this shell sees it.
const REAL_LOCALAPPDATA = process.env.LOCALAPPDATA ?? "";
const REAL_LEGACY_ROOT = IS_WIN ? join(REAL_LOCALAPPDATA || join(REAL_HOME, "AppData", "Local"), "aidemd") : null;
const REAL_ROOTS = [
	["new", REAL_AIDE_ROOT],
	...(REAL_LEGACY_ROOT ? [["legacy", REAL_LEGACY_ROOT]] : []),
];

/** Env with the PATH key normalized (Windows env keys are case-insensitive, Node's copy is not). */
function withPath(base, pathValue) {
	const env = { ...base };
	for (const key of Object.keys(env)) if (key.toLowerCase() === "path") delete env[key];
	env[IS_WIN ? "Path" : "PATH"] = pathValue;
	return env;
}
function getPath(env) {
	const key = Object.keys(env).find((k) => k.toLowerCase() === "path");
	return key ? env[key] : "";
}

// The base env: the caller's env minus anything that would tie a child to the
// session that launched this script (a parent Claude Code session sets these).
const BASE_ENV = { ...process.env };
for (const key of ["CLAUDE_PROJECT_DIR", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT", "AIDE_OBSERVER_PORT", "AIDEMD_HOME"]) {
	delete BASE_ENV[key];
}

// Every AIDE / Claude process the test starts gets this env: AIDEMD_HOME at the
// temp AIDE root (the product uses it as the root itself on every OS, and never
// runs the legacy-root move while it is set), npm's global prefix at the temp prefix
// (so `npm root -g`, and any `npm i -g`, never reach the real global install),
// and the temp prefix's bin dir first on PATH.
const ISO_ENV = withPath(
	{
		...BASE_ENV,
		AIDEMD_HOME: AIDE_ROOT,
		npm_config_prefix: PREFIX,
		NPM_CONFIG_PREFIX: PREFIX,
	},
	[PREFIX_BIN, getPath(BASE_ENV)].join(IS_WIN ? ";" : ":"),
);

// Guard: the isolated AIDE root must be inside the temp root and never a real one.
if (!AIDE_ROOT.startsWith(ROOT) || REAL_ROOTS.some(([, r]) => resolve(AIDE_ROOT).toLowerCase() === resolve(r).toLowerCase())) {
	console.error(`Refusing to run: isolated AIDE root ${AIDE_ROOT} is not isolated from ${REAL_ROOTS.map(([, r]) => r).join(", ")}`);
	process.exit(2);
}

console.log(`release-check temp root: ${ROOT}`);

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

/** Quote one argument for a shell command line (cmd.exe or sh). */
function q(arg) {
	const s = String(arg);
	if (s === "") return '""';
	if (/^[A-Za-z0-9_\-./:=@,+\\]+$/.test(s)) return s;
	return IS_WIN ? `"${s.replace(/"/g, '\\"')}"` : `'${s.replace(/'/g, "'\\''")}'`;
}

let logSeq = 0;
/**
 * Run a command to completion. `shell: true` (the default) runs the joined,
 * quoted command line through the platform shell so `.cmd` shims resolve.
 * stdout/stderr are saved under logs/ and returned.
 */
function run(cmd, args = [], { cwd = ROOT, env = ISO_ENV, input, timeout = 120_000, shell = true, label } = {}) {
	const started = Date.now();
	return new Promise((resolveRun) => {
		const child = shell
			? spawn([cmd, ...args.map(q)].join(" "), { cwd, env, shell: true, windowsHide: true })
			: spawn(cmd, args, { cwd, env, windowsHide: true });
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		child.stdout.on("data", (d) => (stdout += d));
		child.stderr.on("data", (d) => (stderr += d));
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child.pid);
		}, timeout);
		child.on("error", (error) => {
			stderr += `\n[spawn error] ${error.message}`;
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			const name = `${String(++logSeq).padStart(2, "0")}-${(label ?? cmd).replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 50)}`;
			const logBase = join(LOGS, name);
			writeFileSync(`${logBase}.out.txt`, stdout);
			writeFileSync(`${logBase}.err.txt`, stderr);
			resolveRun({ code, stdout, stderr, timedOut, ms: Date.now() - started, log: `${logBase}.out.txt` });
		});
		if (input !== undefined) child.stdin.end(input);
		else child.stdin.end();
	});
}

function killTree(pid) {
	if (!pid) return;
	try {
		if (IS_WIN) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
		else process.kill(pid, "SIGKILL");
	} catch {
		/* already gone */
	}
}

function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return e.code === "EPERM";
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Minimal MCP stdio client (newline-delimited JSON-RPC)
// ---------------------------------------------------------------------------

const mcpChildren = new Set();

class McpClient {
	constructor(label, cwd = PROJECT, env = ISO_ENV) {
		this.label = label;
		this.cwd = cwd;
		this.env = env;
		this.nextId = 1;
		this.pending = new Map();
		this.buffer = "";
		this.stderr = "";
		this.transcript = [];
	}
	/** Launch the packed server exactly as the project's .mcp.json would, from the project dir. */
	async start() {
		// The .mcp.json entry is the bare `aidemd-mcp` command; on Windows that is a
		// .cmd shim around `node <prefix>/node_modules/@aidemd-mcp/server/dist/index.js`.
		// The shim itself is checked in step 2; here the same entry script is run with
		// node directly so the process can be stopped cleanly.
		this.child = spawn(process.execPath, [ENTRY], { cwd: this.cwd, env: this.env, windowsHide: true });
		mcpChildren.add(this.child.pid);
		this.child.stdout.on("data", (d) => this.onData(d));
		this.child.stderr.on("data", (d) => (this.stderr += d));
		this.child.on("close", () => {
			for (const { reject } of this.pending.values()) reject(new Error(`${this.label}: server exited`));
			this.pending.clear();
		});
		const init = await this.request("initialize", {
			protocolVersion: "2025-03-26",
			capabilities: {},
			clientInfo: { name: "aide-release-check", version: "1.0.0" },
		});
		this.notify("notifications/initialized", {});
		return init;
	}
	onData(chunk) {
		this.buffer += chunk;
		let nl;
		while ((nl = this.buffer.indexOf("\n")) !== -1) {
			const line = this.buffer.slice(0, nl).trim();
			this.buffer = this.buffer.slice(nl + 1);
			if (!line) continue;
			let msg;
			try {
				msg = JSON.parse(line);
			} catch {
				continue;
			}
			this.transcript.push({ dir: "in", msg });
			if (msg.id !== undefined && this.pending.has(msg.id)) {
				const { resolve: res, reject, timer } = this.pending.get(msg.id);
				clearTimeout(timer);
				this.pending.delete(msg.id);
				if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
				else res(msg.result);
			}
		}
	}
	send(msg) {
		this.transcript.push({ dir: "out", msg });
		this.child.stdin.write(JSON.stringify(msg) + "\n");
	}
	notify(method, params) {
		this.send({ jsonrpc: "2.0", method, params });
	}
	request(method, params, timeout = 60_000) {
		const id = this.nextId++;
		return new Promise((res, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`${this.label}: ${method} timed out`));
			}, timeout);
			this.pending.set(id, { resolve: res, reject, timer });
			this.send({ jsonrpc: "2.0", id, method, params });
		});
	}
	/** Call a tool; returns its text content joined. */
	async call(name, args = {}, timeout) {
		const result = await this.request("tools/call", { name, arguments: args }, timeout);
		const text = (result.content ?? []).map((c) => c.text ?? "").join("\n");
		return { text, isError: result.isError === true, raw: result };
	}
	async stop() {
		writeFileSync(join(LOGS, `mcp-${this.label}.jsonl`), this.transcript.map((t) => JSON.stringify(t)).join("\n"));
		writeFileSync(join(LOGS, `mcp-${this.label}.stderr.txt`), this.stderr);
		if (!this.child) return;
		try {
			this.child.stdin.end();
		} catch {
			/* ignore */
		}
		await sleep(300);
		killTree(this.child.pid);
		mcpChildren.delete(this.child.pid);
	}
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function sha(text) {
	return createHash("sha256").update(text).digest("hex");
}
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}
/** path -> sha256 for every file under `dir`, skipping .git. */
function snapshot(dir) {
	const out = {};
	const walk = (d) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			if (entry.name === ".git") continue;
			const full = join(d, entry.name);
			if (entry.isDirectory()) walk(full);
			else out[relative(dir, full).split(sep).join("/")] = sha(readFileSync(full));
		}
	};
	walk(dir);
	return out;
}
function diffSnapshots(a, b) {
	const changes = [];
	for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
		if (a[k] !== b[k]) changes.push(`${a[k] === undefined ? "+" : b[k] === undefined ? "-" : "~"} ${k}`);
	}
	return changes;
}
function listFilesUnder(dir) {
	if (!existsSync(dir)) return [];
	const out = [];
	const walk = (d) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const full = join(d, e.name);
			if (e.isDirectory()) walk(full);
			else out.push(full);
		}
	};
	walk(dir);
	return out;
}

/** The project's runtime key, the same rule as src/util/runtimePaths/resolve/nameProjectFolder. */
function projectKeyOf(root) {
	const normalized = resolve(root);
	const name = normalized.split(sep).pop() || "project";
	const hashInput = IS_WIN ? normalized.toLowerCase() : normalized;
	return `${name}-${sha(hashInput).slice(0, 6)}`;
}
const PROJECT_KEY = projectKeyOf(PROJECT);
const presenceFile = (claudeId) => join(AIDE_ROOT, PROJECT_KEY, "presence", `${claudeId}.json`);
const endedMark = (id) => join(AIDE_ROOT, PROJECT_KEY, "ended", `${id}.json`);
const observerFile = join(AIDE_ROOT, "observer.json");

// ---------------------------------------------------------------------------
// Check runner
// ---------------------------------------------------------------------------

const results = []; // { id, name, status, evidence, ms }
const byId = new Map();

async function check(id, name, deps, fn) {
	const blocked = deps.filter((d) => byId.get(d)?.status !== "PASS");
	if (blocked.length > 0) {
		const r = { id, name, status: "SKIP", evidence: `depends on ${blocked.join(", ")}`, ms: 0 };
		results.push(r);
		byId.set(id, r);
		console.log(`  SKIP ${id} ${name} (${r.evidence})`);
		return r;
	}
	const started = Date.now();
	let r;
	try {
		const evidence = await fn();
		r = { id, name, status: "PASS", evidence: evidence ?? "", ms: Date.now() - started };
	} catch (error) {
		r = {
			id,
			name,
			status: error?.skip ? "SKIP" : "FAIL",
			evidence: error?.message ?? String(error),
			ms: Date.now() - started,
		};
	}
	results.push(r);
	byId.set(id, r);
	console.log(`  ${r.status} ${id} ${name}${r.status === "PASS" ? "" : ` -- ${r.evidence.split("\n")[0]}`}`);
	return r;
}
function assert(cond, message) {
	if (!cond) throw new Error(message);
}
function skip(message) {
	const e = new Error(message);
	e.skip = true;
	return e;
}

// ---------------------------------------------------------------------------
// Real-setup baseline (read-only)
// ---------------------------------------------------------------------------

function realBaseline() {
	const npmLs = spawnSync(`npm ls -g ${PKG} --depth=0`, { shell: true, env: withPath(BASE_ENV, getPath(BASE_ENV)), encoding: "utf8", windowsHide: true });
	// Each real root (new, and on Windows the legacy one): its observer.json and any test-project folders.
	const roots = {};
	for (const [name, dir] of REAL_ROOTS) {
		const file = join(dir, "observer.json");
		let observer = null;
		try {
			const text = readFileSync(file, "utf8");
			let pid = null;
			let port = null;
			try {
				const rec = JSON.parse(text);
				pid = rec.pid;
				port = rec.address ? Number(new URL(rec.address).port) : null;
			} catch {
				/* not JSON */
			}
			observer = { file, mtime: statSync(file).mtime.toISOString(), sha: sha(text).slice(0, 16), pid, port };
		} catch {
			/* missing or unreadable */
		}
		let entries = [];
		try {
			entries = readdirSync(dir).sort();
		} catch {
			/* no root */
		}
		roots[name] = { dir, observer, testFolders: entries.filter((n) => n.startsWith("rc-project")), entryCount: entries.length };
	}
	// The record the real observer is judged by: the new root's, else the legacy root's.
	const source = roots.new.observer ? "new" : roots.legacy?.observer ? "legacy" : null;
	const observer = source ? roots[source].observer : null;
	// The real observer may sit on any port of its list (24680 is only the first), so judge the
	// port its own record names; with no readable record, fall back to the first port.
	const realPort = observer?.port ?? REAL_PORT;
	let listenPid = null;
	const net = IS_WIN
		? spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true }).stdout ?? ""
		: "";
	for (const line of net.split(/\r?\n/)) {
		if (line.includes(`127.0.0.1:${realPort} `) && line.includes("LISTENING")) listenPid = Number(line.trim().split(/\s+/).pop());
	}
	return {
		npmLs: (npmLs.stdout ?? "").trim(),
		observer,
		observerSource: source,
		listenPid,
		realPort,
		roots,
	};
}

// ---------------------------------------------------------------------------
// Hook helper
// ---------------------------------------------------------------------------

/** Pipe one hook input into `aidemd-mcp hook` exactly as Claude Code would (through the shell, via PATH). */
function runHook(input, label) {
	return run("aidemd-mcp", ["hook"], {
		cwd: PROJECT,
		env: { ...ISO_ENV, CLAUDE_PROJECT_DIR: PROJECT },
		input: JSON.stringify(input),
		timeout: 15_000,
		label: `hook-${label}`,
	});
}
function hookInput(sessionId, event, extra = {}) {
	return {
		session_id: sessionId,
		transcript_path: join(ROOT, "transcripts", `${sessionId}.jsonl`),
		cwd: PROJECT,
		hook_event_name: event,
		...extra,
	};
}
function readPresence(claudeId) {
	const f = presenceFile(claudeId);
	return existsSync(f) ? readJson(f) : null;
}
const tagOf = (text) => /\[observer-session ([A-Za-z0-9][A-Za-z0-9._-]*)\]/.exec(text)?.[1] ?? null;
const linkOf = (text) => /(http:\/\/127\.0\.0\.1:\d+\/\S+)/.exec(text)?.[1] ?? null;
const portOf = (link) => Number(new URL(link).port);
/** The `outdated` array from an aide_info reply, or null when it has none. */
const outdatedOf = (text) => {
	const m = /"outdated"\s*:\s*(\[[^\]]*\])/.exec(text);
	try {
		return m ? JSON.parse(m[1]) : null;
	} catch {
		return null;
	}
};

// ---------------------------------------------------------------------------
// Headless Claude helpers
// ---------------------------------------------------------------------------

const ALLOWED_TOOLS = [
	"mcp__aide",
	"mcp__brain",
	"Skill",
	"Read",
	"Glob",
	"Grep",
	"Agent",
	"TodoWrite",
	"Bash(git status:*)",
	"Bash(git log:*)",
	"Bash(npm ls:*)",
].join(",");

function claudeArgs(format) {
	return [
		"-p",
		"--output-format",
		format,
		...(format === "stream-json" ? ["--verbose"] : []),
		"--strict-mcp-config",
		"--mcp-config",
		join(PROJECT, ".mcp.json"),
		"--setting-sources",
		"project,local",
		"--allowedTools",
		ALLOWED_TOOLS,
	];
}

/** Run `claude -p` with the prompt on stdin; returns the parsed stream plus run info. */
async function runClaude(prompt, label, maxTurns = 40) {
	const r = await run("claude", [...claudeArgs("stream-json"), "--max-turns", String(maxTurns)], {
		cwd: PROJECT,
		env: ISO_ENV,
		input: prompt,
		timeout: HEADLESS_TIMEOUT_MS,
		label: `claude-${label}`,
	});
	const transcriptPath = join(ROOT, `transcript-${label}.jsonl`);
	writeFileSync(transcriptPath, r.stdout);
	const events = [];
	for (const line of r.stdout.split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			events.push(JSON.parse(line));
		} catch {
			/* non-JSON noise */
		}
	}
	const init = events.find((e) => e.type === "system" && e.subtype === "init");
	const final = events.find((e) => e.type === "result");
	const toolUses = [];
	const toolResults = new Map();
	for (const e of events) {
		const content = e.message?.content;
		if (!Array.isArray(content)) continue;
		for (const c of content) {
			if (e.type === "assistant" && c.type === "tool_use") toolUses.push({ id: c.id, name: c.name, input: c.input });
			if (e.type === "user" && c.type === "tool_result") {
				const text = Array.isArray(c.content) ? c.content.map((x) => x.text ?? "").join("\n") : String(c.content ?? "");
				toolResults.set(c.tool_use_id, text);
			}
		}
	}
	for (const t of toolUses) t.result = toolResults.get(t.id) ?? null;
	return { ...r, transcriptPath, events, init, final, toolUses, sessionId: init?.session_id ?? final?.session_id ?? null };
}
const short = (name) => String(name).split("__").pop();

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const t0 = Date.now();
const realBefore = realBaseline();
writeFileSync(join(ROOT, "real-baseline-before.json"), JSON.stringify(realBefore, null, 2));
console.log(
	`real baseline: observer pid ${realBefore.observer?.pid ?? "none"} (record ${realBefore.observer?.file ?? `none in ${REAL_ROOTS.map(([, r]) => r).join(" or ")}`}, ${realBefore.observerSource ?? "no"} root), port ${realBefore.realPort} listener pid ${realBefore.listenPid ?? "none"}`,
);
if (realBefore.listenPid && !realBefore.observer) {
	console.log(`  WARNING: port ${realBefore.realPort} is listening but the real observer record was not readable; check 9.real will FAIL.`);
}

let packedVersion = null;
let tgz = null;
const state = {}; // links, ids, etc. shared between steps

// 1. Build and pack ----------------------------------------------------------
console.log("\n[1] build and pack");
await check("1.build", "npm run build", [], async () => {
	if (SKIP_BUILD) return "skipped by --skip-build (using existing dist/)";
	const r = await run("npm", ["run", "build"], { cwd: REPO, env: BASE_ENV, timeout: 600_000, label: "build" });
	assert(r.code === 0, `build exited ${r.code}; see ${r.log}`);
	return `exit 0 in ${r.ms} ms`;
});
await check("1.pack", "npm pack", ["1.build"], async () => {
	const r = await run("npm", ["pack", "--pack-destination", PACK_DIR, "--json"], { cwd: REPO, env: BASE_ENV, timeout: 300_000, label: "pack" });
	assert(r.code === 0, `npm pack exited ${r.code}; see ${r.log}`);
	const json = JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
	tgz = join(PACK_DIR, json[0].filename);
	packedVersion = json[0].version;
	assert(existsSync(tgz), `tarball missing at ${tgz}`);
	const files = json[0].files.map((f) => f.path);
	writeFileSync(join(ROOT, "pack-files.txt"), files.join("\n"));
	assert(files.includes("dist/index.js"), "dist/index.js not in the tarball");
	assert(!files.some((f) => f === ".aide/versions.json"), ".aide/versions.json shipped (excluded in package.json files)");
	return `${json[0].filename} v${packedVersion}, ${files.length} files (list: ${join(ROOT, "pack-files.txt")})`;
});

// 2. Install into the temp prefix --------------------------------------------
console.log("\n[2] install into temp prefix");
await check("2.install", "npm install -g <tgz> --prefix <tmp>", ["1.pack"], async () => {
	// No LOCALAPPDATA override here: npm's cache lives there, and this is npm, not AIDE.
	const r = await run("npm", ["install", "-g", tgz, "--prefix", PREFIX], { cwd: ROOT, env: BASE_ENV, timeout: 600_000, label: "install" });
	assert(r.code === 0, `npm install exited ${r.code}; see ${r.log}`);
	const installed = readJson(join(PKG_DIR, "package.json")).version;
	assert(installed === packedVersion, `installed ${installed} != packed ${packedVersion}`);
	return `${PKG}@${installed} in ${PKG_DIR}`;
});
await check("2.resolve", "aidemd-mcp resolves to the temp prefix", ["2.install"], async () => {
	const where = IS_WIN
		? await run("where", ["aidemd-mcp"], { label: "where-aidemd-mcp" })
		: await run("command", ["-v", "aidemd-mcp"], { label: "which-aidemd-mcp" });
	const first = where.stdout.split(/\r?\n/).find((l) => l.trim()) ?? "";
	assert(first.toLowerCase().startsWith(PREFIX_BIN.toLowerCase()), `first aidemd-mcp on PATH is ${first}, not under ${PREFIX_BIN}`);
	const help = await run("aidemd-mcp", ["sync", "--help"], { label: "sync-help" });
	assert(help.code === 2 && help.stdout.startsWith("Usage:"), `\`aidemd-mcp sync --help\` exited ${help.code}: ${help.stdout.slice(0, 80)}`);
	const npmRoot = await run("npm", ["root", "-g"], { label: "npm-root-g" });
	assert(npmRoot.stdout.trim().toLowerCase().startsWith(PREFIX.toLowerCase()), `npm root -g under ISO env is ${npmRoot.stdout.trim()}`);
	return `${first}; npm root -g -> ${npmRoot.stdout.trim()}`;
});
await check("2.version", "aide_info serverVersion equals packed", ["2.resolve"], async () => {
	// A throwaway cwd: just asking the server its version.
	const probeDir = join(ROOT, "version-probe");
	mkdirSync(probeDir, { recursive: true });
	const client = new McpClient("version-probe", probeDir);
	try {
		const init = await client.start();
		state.serverInfoVersion = init.serverInfo?.version ?? null;
		const info = await client.call("aide_info", {}, 90_000);
		writeFileSync(join(LOGS, "aide_info-probe.txt"), info.text);
		const infoVersion = JSON.parse(info.text).serverVersion;
		assert(infoVersion === packedVersion, `aide_info serverVersion ${infoVersion} != ${packedVersion}`);
		return `aide_info serverVersion ${infoVersion}`;
	} finally {
		await client.stop();
	}
});
await check("2.serverInfo", "MCP initialize serverInfo.version equals packed", ["2.version"], async () => {
	// The version MCP clients see in the initialize handshake (src/startServer).
	assert(state.serverInfoVersion === packedVersion, `initialize serverInfo.version is ${state.serverInfoVersion}, package is ${packedVersion}`);
	return `serverInfo.version ${state.serverInfoVersion}`;
});

// 3. Test project --------------------------------------------------------------
console.log("\n[3] test project");
function seedProject(dir) {
	mkdirSync(dir, { recursive: true });
	spawnSync("git", ["init", "-q"], { cwd: dir, windowsHide: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "rc-project", version: "0.0.0", private: true }, null, 2) + "\n");
	writeFileSync(join(dir, "CLAUDE.md"), "# rc-project\n\nThrowaway project for the AIDE release check.\n");
}
await check("3.init", "aidemd-mcp init --brain obsidian", ["2.resolve"], async () => {
	seedProject(PROJECT);
	const r = await run("aidemd-mcp", ["init", "--brain", "obsidian"], { cwd: PROJECT, label: "init-1", timeout: 180_000 });
	writeFileSync(join(ROOT, "init-1.txt"), r.stdout + r.stderr);
	assert(r.code === 0, `init exited ${r.code}; see ${r.log}`);
	assert(!/Installing @aidemd-mcp\/server globally/.test(r.stdout), "init tried a global install (temp prefix not seen as installed)");
	return `exit 0; log ${join(ROOT, "init-1.txt")}`;
});
await check("3.wire", "brain wired to temp vault + sync + kanban tag", ["3.init"], async () => {
	const brainAide = join(PROJECT, ".aide", "config", "brain.aide");
	// The unwired slot is the bare-dash YAML null entry under mcpServerConfig.args
	// (the last one), exactly what /aide:brain config fills.
	const lines = readFileSync(brainAide, "utf8").split("\n");
	const argsAt = lines.findIndex((l) => /^\s+args:\s*\r?$/.test(l));
	assert(argsAt !== -1, "no mcpServerConfig.args in brain.aide");
	let slot = -1;
	for (let i = argsAt + 1; i < lines.length && /^\s+-/.test(lines[i]); i++) if (/^\s+-\s*\r?$/.test(lines[i])) slot = i;
	assert(slot !== -1, "no YAML null slot under mcpServerConfig.args");
	const cr = lines[slot].endsWith("\r") ? "\r" : "";
	lines[slot] = lines[slot].replace(/-\s*\r?$/, `- ${JSON.stringify(VAULT)}${cr}`);
	// The board is read from the kanban field's path (the vault path joined with "kanban"),
	// exactly what /aide:brain config fills; sessions report no brain folder.
	const kanbanAt = lines.findIndex((l) => /^kanban:\s*\r?$/.test(l));
	assert(kanbanAt !== -1, "no kanban field in the scaffolded brain.aide");
	let pathAt = -1;
	for (let i = kanbanAt + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) {
		if (/^\s+path:/.test(lines[i])) {
			pathAt = i;
			break;
		}
	}
	assert(pathAt !== -1, "no kanban field in the scaffolded brain.aide");
	const pathCr = lines[pathAt].endsWith("\r") ? "\r" : "";
	lines[pathAt] = `  path: ${JSON.stringify(join(VAULT, "kanban"))}${pathCr}`;
	writeFileSync(brainAide, lines.join("\n"));
	// One task on the board the harness's observer must show (inside the temp ROOT only).
	const backlog = join(VAULT, "kanban", "release-check", "backlog");
	mkdirSync(backlog, { recursive: true });
	writeFileSync(join(backlog, "release-check-task.md"), "---\npriority: p2\n---\n# Release check task\n");
	const r = await run("aidemd-mcp", ["sync"], { cwd: PROJECT, label: "sync" });
	assert(r.code === 0, `sync exited ${r.code}: ${r.stdout}${r.stderr}`);
	const claudeMd = join(PROJECT, "CLAUDE.md");
	writeFileSync(claudeMd, readFileSync(claudeMd, "utf8").replace(/\s*$/, "\n\n## Kanban\n\nKanban project tag: release-check\n"));
	const mcp = readJson(join(PROJECT, ".mcp.json"));
	const brainArgs = mcp.mcpServers?.brain?.args ?? [];
	assert(brainArgs[brainArgs.length - 1] === VAULT, `brain args end with ${brainArgs[brainArgs.length - 1]}, not the temp vault`);
	return `sync: ${r.stdout.trim().split(/\r?\n/).pop()}`;
});
await check("3.assert", ".mcp.json, hooks and observer skill installed", ["3.init"], async () => {
	const mcp = readJson(join(PROJECT, ".mcp.json"));
	assert(mcp.mcpServers?.aide?.command === "aidemd-mcp", `aide entry: ${JSON.stringify(mcp.mcpServers?.aide)}`);
	assert(mcp.mcpServers?.brain, "no brain entry in .mcp.json (wiring step failed?)");
	const settings = readJson(join(PROJECT, ".claude", "settings.json"));
	const events = ["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop", "SessionEnd"];
	const wired = events.filter((ev) =>
		(settings.hooks?.[ev] ?? []).some((g) => (g.hooks ?? []).some((h) => h.type === "command" && h.command.trim() === "aidemd-mcp hook")),
	);
	assert(wired.length === 5, `hook events wired: ${wired.join(", ")}`);
	assert(existsSync(join(PROJECT, ".claude", "skills", "aide-observer", "SKILL.md")), "aide-observer skill missing");
	return `aide=${JSON.stringify(mcp.mcpServers.aide)}; brain=${mcp.mcpServers.brain.command}; hooks: ${wired.join(", ")}`;
});
await check("3.idempotent", "init run twice changes nothing", ["3.wire"], async () => {
	const before = snapshot(PROJECT);
	const r = await run("aidemd-mcp", ["init", "--brain", "obsidian"], { cwd: PROJECT, label: "init-2", timeout: 180_000 });
	writeFileSync(join(ROOT, "init-2.txt"), r.stdout + r.stderr);
	assert(r.code === 0, `second init exited ${r.code}`);
	const changes = diffSnapshots(before, snapshot(PROJECT));
	assert(changes.length === 0, `second init changed:\n${changes.join("\n")}`);
	assert(!/\[created\]/.test(r.stdout), "second init reported [created] lines");
	return `0 files changed across ${Object.keys(before).length} files`;
});

// 4. Existing settings files ---------------------------------------------------
console.log("\n[4] init against existing settings files");
await check("4.merge", "existing settings.json left byte-identical + /aide:upgrade deferred", ["2.resolve"], async () => {
	const dir = join(ROOT, "rc-project-settings");
	seedProject(dir);
	mkdirSync(join(dir, ".claude"), { recursive: true });
	const original =
		"{\n" +
		"  // the user's own comment\n" +
		'  "permissions": { "allow": ["Bash(ls:*)"] },\n' +
		'  "hooks": {\n' +
		'    "Stop": [{ "hooks": [{ "type": "command", "command": "echo user-hook" }] }]\n' +
		"  },\n" +
		'  "model": "sonnet"\n' +
		"}\n";
	writeFileSync(join(dir, ".claude", "settings.json"), original);
	const r = await run("aidemd-mcp", ["init", "--brain", "obsidian"], { cwd: dir, label: "init-existing", timeout: 180_000 });
	writeFileSync(join(ROOT, "init-existing.txt"), r.stdout + r.stderr);
	assert(r.code === 0, `init exited ${r.code}`);
	const after = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
	assert(after === original, "settings.json bytes changed");
	assert(/run \/aide:upgrade, then confirm the hooks category/.test(r.stdout), "no /aide:upgrade hooks deferred line");
	assert(/\[skipped-drift\] \.claude\/settings\.json/.test(r.stdout), "no [skipped-drift] line for .claude/settings.json");
	return `byte-identical; deferred line present; log ${join(ROOT, "init-existing.txt")}`;
});
await check("4.boot", "aide_info lists `hooks` in outdated when the hooks were deferred", ["4.merge"], async () => {
	// The /aide boot offers /aide:upgrade only when `outdated` is non-empty, so a
	// project whose hooks were deferred must see `hooks` there.
	const client = new McpClient("boot-hooks", join(ROOT, "rc-project-settings"));
	try {
		await client.start();
		const info = await client.call("aide_info", {}, 90_000);
		writeFileSync(join(LOGS, "aide_info-hooks-deferred.txt"), info.text);
		const outdated = outdatedOf(info.text);
		assert(outdated, `no outdated array in aide_info; see ${join(LOGS, "aide_info-hooks-deferred.txt")}`);
		assert(outdated.includes("hooks"), `outdated is ${JSON.stringify(outdated)}, expected it to include "hooks"`);
		return `outdated ${JSON.stringify(outdated)}`;
	} finally {
		await client.stop();
	}
});
await check("4.malformed", "malformed settings.json -> [skipped-malformed]", ["2.resolve"], async () => {
	const dir = join(ROOT, "rc-project-malformed");
	seedProject(dir);
	mkdirSync(join(dir, ".claude"), { recursive: true });
	const original = '{ "hooks": { "Stop": [ \n';
	writeFileSync(join(dir, ".claude", "settings.json"), original);
	const r = await run("aidemd-mcp", ["init", "--brain", "obsidian"], { cwd: dir, label: "init-malformed", timeout: 180_000 });
	writeFileSync(join(ROOT, "init-malformed.txt"), r.stdout + r.stderr);
	assert(r.code === 0, `init exited ${r.code}`);
	assert(readFileSync(join(dir, ".claude", "settings.json"), "utf8") === original, "malformed settings.json was changed");
	assert(/\[skipped-malformed\] \.claude\/settings\.json/.test(r.stdout), "no [skipped-malformed] line");
	assert(/settings\.json is not valid JSON/.test(r.stdout), "no malformed-hooks deferred line");
	return `left unchanged; [skipped-malformed] reported; log ${join(ROOT, "init-malformed.txt")}`;
});

// 5. Hook in situ ------------------------------------------------------------
console.log("\n[5] hook in situ");
await check("5.hook", "aidemd-mcp hook: silent, exit 0, presence only in the temp AIDE root", ["3.assert"], async () => {
	const before = snapshot(PROJECT);
	const id = `rc-hook-${randomUUID()}`;
	const fakeObserverSession = `rc-observer-${randomUUID().slice(0, 8)}`;
	const steps = [
		["SessionStart", hookInput(id, "SessionStart", { source: "startup" }), "working"],
		[
			"PostToolUse",
			hookInput(id, "PostToolUse", {
				tool_name: "mcp__aide__aide_observer_event",
				tool_input: { kind: "session_started" },
				tool_response: [{ type: "text", text: `recorded [observer-session ${fakeObserverSession}]` }],
			}),
			"working",
		],
		["Stop", hookInput(id, "Stop", { stop_hook_active: false }), "waiting"],
		["SessionEnd", hookInput(id, "SessionEnd", { reason: "other" }), "ended"],
	];
	const notes = [];
	for (const [event, input, expectState] of steps) {
		const r = await runHook(input, event);
		assert(r.code === 0, `${event}: exit ${r.code}`);
		assert(r.stdout === "" && r.stderr === "", `${event}: output stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`);
		const p = readPresence(id);
		assert(p, `${event}: no presence file at ${presenceFile(id)}`);
		assert(p.state === expectState, `${event}: presence state ${p.state}, expected ${expectState}`);
		if (event !== "SessionStart") assert(p.sessionId === fakeObserverSession, `${event}: presence not linked (sessionId ${p.sessionId})`);
		notes.push(`${event}->${p.state} (${r.ms} ms)`);
	}
	const changes = diffSnapshots(before, snapshot(PROJECT));
	assert(changes.length === 0, `hook wrote into the project:\n${changes.join("\n")}`);
	for (const [name, dir] of REAL_ROOTS) {
		assert(!existsSync(join(dir, PROJECT_KEY)), `project folder appeared in the REAL ${name} root: ${join(dir, PROJECT_KEY)}`);
	}
	return `${notes.join(", ")}; presence ${presenceFile(id)}`;
});

// 6-8 (simulated agent). Drives the packed MCP server over stdio exactly as the
// aide-observer skill tells an agent to, with the hook calls Claude Code would
// make. Deterministic; runs whether or not `claude -p` is available.
console.log("\n[6s] simulated agent session (MCP stdio + hooks)");
await check("6s.session", "session_started -> link -> start returns link on a port other than the real observer's, no HALT", ["3.wire", "5.hook"], async () => {
	const claudeId = randomUUID();
	state.sim1 = { claudeId };
	await runHook(hookInput(claudeId, "SessionStart", { source: "startup" }), "sim1-SessionStart");
	const client = new McpClient("sim1");
	state.sim1.client = client;
	await client.start();
	const tools = (await client.request("tools/list", {})).tools.map((t) => t.name);
	for (const t of ["aide_observer_event", "aide_observer_start", "aide_observer_end_session", "aide_info"]) {
		assert(tools.includes(t), `tool ${t} missing from tools/list`);
	}
	const info = await client.call("aide_info", {}, 90_000);
	writeFileSync(join(LOGS, "aide_info-project.txt"), info.text);
	assert(/"status"\s*:\s*"ok"/.test(info.text), `aide_info brain status not ok; see ${join(LOGS, "aide_info-project.txt")}`);
	const outdated = outdatedOf(info.text);
	assert(outdated && !outdated.includes("hooks"), `freshly initialised project reports outdated ${JSON.stringify(outdated)}; hooks should be current`);
	const started = await client.call("aide_observer_event", { kind: "session_started", projectRoot: PROJECT, kanbanTag: "release-check" });
	const obsId = tagOf(started.text);
	assert(obsId, `session_started reply has no session tag: ${started.text}`);
	state.sim1.obsId = obsId;
	// Claude Code's PostToolUse hook fires as the reply comes back.
	await runHook(
		hookInput(claudeId, "PostToolUse", {
			tool_name: "mcp__aide__aide_observer_event",
			tool_input: { kind: "session_started" },
			tool_response: started.raw.content,
		}),
		"sim1-PostToolUse",
	);
	await client.call("aide_observer_event", { kind: "prompt", text: "/aide" });
	const start = await client.call("aide_observer_start", {}, 60_000);
	writeFileSync(join(LOGS, "sim1-start.txt"), start.text);
	assert(!/^HALT:/.test(start.text) && !/^BLOCKED:/.test(start.text), `start replied: ${start.text}`);
	assert(/^Observer (already )?running at /.test(start.text), `unexpected start reply: ${start.text}`);
	const link = linkOf(start.text);
	assert(link, `no link in start reply: ${start.text}`);
	assert(!(realBefore.listenPid && portOf(link) === realBefore.realPort), `observer link is on ${realBefore.realPort} (the real observer's port): ${link}`);
	state.link = link;
	assert(existsSync(observerFile), `no observer record at ${observerFile}`);
	const rec = readJson(observerFile);
	state.observerPid = rec.pid;
	assert(rec.pid !== realBefore.observer?.pid, "temp observer record names the real observer's pid");
	assert(Number(new URL(rec.address).port) === portOf(link), `record port ${rec.address} != link port`);
	const presence = readPresence(claudeId);
	assert(presence?.sessionId === obsId, `presence ${claudeId} linked to ${presence?.sessionId}, expected ${obsId}`);
	return `${start.text.split("\n")[0].replace(/token=[0-9a-f]+/, "token=…")}; observer pid ${rec.pid}; presence linked to ${obsId}`;
});

console.log("\n[8] observer page smoke");
await check("8.page", "GET link + JSON API: 200 and liveness states", ["6s.session"], async () => {
	const url = new URL(state.link);
	const token = url.searchParams.get("token");
	const page = await fetch(state.link);
	const html = await page.text();
	writeFileSync(join(LOGS, "page.html"), html);
	assert(page.status === 200, `GET link -> ${page.status}`);
	const headers = { "x-aide-observer-token": token };
	const projects = await fetch(`${url.origin}/api/projects`, { headers });
	const projectsBody = await projects.json();
	writeFileSync(join(LOGS, "api-projects.json"), JSON.stringify(projectsBody, null, 2));
	assert(projects.status === 200, `/api/projects -> ${projects.status}`);
	assert(JSON.stringify(projectsBody).includes(PROJECT_KEY), `/api/projects does not list ${PROJECT_KEY}`);
	const sessions = await fetch(`${url.origin}/api/projects/${encodeURIComponent(PROJECT_KEY)}/sessions`, { headers });
	const sessionsBody = await sessions.json();
	writeFileSync(join(LOGS, "api-sessions.json"), JSON.stringify(sessionsBody, null, 2));
	assert(sessions.status === 200, `/api/projects/:key/sessions -> ${sessions.status}`);
	const rows = sessionsBody.data?.sessions ?? [];
	const states = rows.map((s) => s.liveness?.state ?? s.state ?? "?");
	assert(rows.length > 0, "no sessions listed");
	assert(states.every((s) => ["working", "waiting", "ended"].includes(s)), `unexpected liveness states: ${states.join(",")}`);
	const own = rows.find((s) => s.sessionId === state.sim1.obsId || s.id === state.sim1.obsId);
	assert(own, `own session ${state.sim1.obsId} not listed`);
	// The session in 6s.session reports only projectRoot and kanbanTag (no brain folder), which is
	// the case the board must still work in: it reads from the kanban field of the brain config.
	const statusRes = await fetch(`${url.origin}/api/projects/${encodeURIComponent(PROJECT_KEY)}/status`, { headers });
	const statusBody = await statusRes.json();
	writeFileSync(join(LOGS, "api-status.json"), JSON.stringify(statusBody, null, 2));
	assert(statusRes.status === 200, `/api/projects/:key/status -> ${statusRes.status}`);
	const board = statusBody.data?.status?.board;
	const boardWhy = board?.state === "unavailable" ? `${board.reason}: ${board.detail}` : `board ${JSON.stringify(board)?.slice(0, 200)}`;
	assert(board?.state === "available", `board not available (${boardWhy}); see ${join(LOGS, "api-status.json")}`);
	const boardTasks = (board.columns ?? []).flatMap((c) => c.tasks ?? []);
	assert(boardTasks.some((t) => t.slug === "release-check-task"), `board lacks task release-check-task; has ${boardTasks.map((t) => t.slug).join(",") || "none"}`);
	const noToken = await fetch(`${url.origin}/api/projects`);
	assert(noToken.status === 401 || noToken.status === 403, `/api/projects without token -> ${noToken.status}`);
	return `page 200 (${html.length} bytes); ${rows.length} sessions [${states.join(", ")}]; board available with ${boardTasks.length} task(s); no-token -> ${noToken.status}`;
});

await check("6s.end", "sim session ends via Stop + SessionEnd hooks", ["6s.session"], async () => {
	const { claudeId, client } = state.sim1;
	await runHook(hookInput(claudeId, "Stop", { stop_hook_active: false }), "sim1-Stop");
	await runHook(hookInput(claudeId, "SessionEnd", { reason: "prompt_input_exit" }), "sim1-SessionEnd");
	await client.stop();
	const p = readPresence(claudeId);
	assert(p?.state === "ended", `presence state after SessionEnd: ${p?.state}`);
	return `presence ended; ended mark present: ${existsSync(endedMark(state.sim1.obsId))}`;
});

console.log("\n[7s] simulated HALT");
await check("7s.halt", "open unlinked Claude session -> start HALTs naming claude:<id>", ["6s.end"], async () => {
	const fake = `rc-fake-${randomUUID().slice(0, 8)}`;
	state.fakeSim = fake;
	await runHook(hookInput(fake, "SessionStart", { source: "startup" }), "fake-sim-SessionStart");
	assert(readPresence(fake)?.state === "working", "fake presence not written");
	const claudeId = randomUUID();
	state.sim2 = { claudeId };
	await runHook(hookInput(claudeId, "SessionStart", { source: "startup" }), "sim2-SessionStart");
	const client = new McpClient("sim2");
	state.sim2.client = client;
	await client.start();
	const started = await client.call("aide_observer_event", { kind: "session_started", projectRoot: PROJECT, kanbanTag: "release-check" });
	state.sim2.obsId = tagOf(started.text);
	await runHook(
		hookInput(claudeId, "PostToolUse", { tool_name: "mcp__aide__aide_observer_event", tool_response: started.raw.content }),
		"sim2-PostToolUse",
	);
	const start = await client.call("aide_observer_start", {}, 60_000);
	writeFileSync(join(LOGS, "sim2-start-halt.txt"), start.text);
	assert(/^HALT:/.test(start.text), `expected HALT, got: ${start.text.split("\n")[0]}`);
	assert(start.text.includes(`claude:${fake}`), `HALT does not name claude:${fake}:\n${start.text}`);
	const others = start.text.split("\n").slice(1, -1);
	return `HALT with ${others.length} open line(s): ${others.map((l) => l.trim().slice(0, 80)).join(" | ")}`;
});
await check("7s.end", "end_session writes the ended mark; start then passes", ["7s.halt"], async () => {
	const { client } = state.sim2;
	const ended = await client.call("aide_observer_end_session", { sessionId: state.fakeSim });
	assert(/^ended /.test(ended.text), `end_session replied: ${ended.text}`);
	const mark = endedMark(state.fakeSim);
	assert(existsSync(mark), `no ended mark at ${mark}`);
	const markJson = readJson(mark);
	assert(markJson.endedBy === "user", `mark endedBy ${markJson.endedBy}`);
	const own = await client.call("aide_observer_end_session", { sessionId: state.sim2.obsId });
	assert(/^refused: .* is this session/.test(own.text), `ending own session replied: ${own.text}`);
	const start = await client.call("aide_observer_start", {}, 60_000);
	writeFileSync(join(LOGS, "sim2-start-after.txt"), start.text);
	assert(/^Observer (already )?running at /.test(start.text), `start after end replied: ${start.text.split("\n")[0]}`);
	await runHook(hookInput(state.sim2.claudeId, "SessionEnd", { reason: "prompt_input_exit" }), "sim2-SessionEnd");
	await client.stop();
	return `${ended.text}; mark ${mark}; own-session refusal ok; restart: ${start.text.split("\n")[0].replace(/token=[0-9a-f]+/, "token=…")}`;
});

// 6-7 (headless Claude) -------------------------------------------------------
console.log("\n[6h/7h] headless claude -p");
await check("6h.preflight", "claude -p works with AIDEMD_HOME set", ["3.wire"], async () => {
	if (NO_CLAUDE) throw skip("--no-claude");
	const r = await run("claude", [...claudeArgs("json"), "--max-turns", "1"], {
		cwd: PROJECT,
		env: ISO_ENV,
		input: "Reply with exactly: pong",
		timeout: 180_000,
		label: "claude-preflight",
	});
	let j = null;
	try {
		j = JSON.parse(r.stdout);
	} catch {
		/* not JSON */
	}
	if (j?.is_error && /authenticat|log ?in|login/i.test(String(j.result))) {
		throw skip(`Claude Code is not signed in for headless use: ${String(j.result).slice(0, 200)}`);
	}
	if (!j || j.is_error) {
		throw new Error(`claude -p failed with AIDEMD_HOME set: ${j ? String(j.result).slice(0, 200) : r.stderr.slice(0, 200)}; see ${r.log}`);
	}
	return `pong in ${r.ms} ms (session ${j.session_id})`;
});

await check("6h.run1", "claude -p /aide: observer first, link off the real observer's port, no HALT, presence linked", ["6h.preflight", "7s.end"], async () => {
	const r = await runClaude("/aide", "run1");
	state.run1 = r;
	assert(!r.timedOut, `timed out after ${HEADLESS_TIMEOUT_MS} ms; transcript ${r.transcriptPath}`);
	assert(r.sessionId, `no session id in the stream; transcript ${r.transcriptPath}`);
	const aideCalls = r.toolUses.filter((t) => t.name.startsWith("mcp__aide__"));
	assert(aideCalls.length > 0, `no aide tool calls; transcript ${r.transcriptPath}`);
	const first = aideCalls[0];
	assert(short(first.name) === "aide_observer_event" && first.input?.kind === "session_started", `first aide call was ${first.name} ${JSON.stringify(first.input)}`);
	const startCall = aideCalls.find((t) => short(t.name) === "aide_observer_start");
	assert(startCall, "aide_observer_start never called");
	assert(startCall.result && !/^HALT:|^BLOCKED:/.test(startCall.result), `start replied: ${startCall.result?.split("\n")[0]}`);
	const link = linkOf(startCall.result);
	assert(link && !(realBefore.listenPid && portOf(link) === realBefore.realPort), `start link ${link} is missing or on the real observer's port ${realBefore.realPort}`);
	const firstStartIdx = aideCalls.indexOf(startCall);
	const before = aideCalls.slice(0, firstStartIdx).map((t) => short(t.name));
	assert(before.every((n) => n === "aide_observer_event"), `calls before observer start: ${before.join(", ")}`);
	assert(existsSync(observerFile), "observer record missing from the temp AIDE root");
	const presence = readPresence(r.sessionId);
	assert(presence?.sessionId === tagOf(first.result ?? ""), `presence for ${r.sessionId}: ${JSON.stringify(presence)}`);
	const bootCalls = aideCalls.filter((t) => short(t.name) === "aide_info").length;
	return `session ${r.sessionId}; start: ${startCall.result.split("\n")[0].replace(/token=[0-9a-f]+/, "token=…")}; boot aide_info calls ${bootCalls}; presence state ${presence.state}; ${r.toolUses.length} tool calls; transcript ${r.transcriptPath}`;
});

await check("7h.halt", "claude -p /aide with an open Claude session: HALT names it, no boot", ["6h.preflight", "7s.end"], async () => {
	const fake = `rc-fake-${randomUUID().slice(0, 8)}`;
	state.fakeHeadless = fake;
	await runHook(hookInput(fake, "SessionStart", { source: "startup" }), "fake-headless-SessionStart");
	const r = await runClaude("/aide", "run2-halt", 20);
	state.run2 = r;
	assert(!r.timedOut, `timed out; transcript ${r.transcriptPath}`);
	const starts = r.toolUses.filter((t) => short(t.name) === "aide_observer_start");
	assert(starts.length > 0, `aide_observer_start never called; transcript ${r.transcriptPath}`);
	assert(/^HALT:/.test(starts[0].result ?? ""), `start replied: ${starts[0].result?.split("\n")[0]}`);
	assert(starts[0].result.includes(`claude:${fake}`), `HALT does not name claude:${fake}`);
	const bootCalls = r.toolUses.filter((t) => ["aide_info", "aide_discover"].includes(short(t.name)));
	const aideSkill = r.toolUses.filter((t) => t.name === "Skill" && /^aide$/.test(String(t.input?.skill ?? t.input?.command ?? "")));
	const endCalls = r.toolUses.filter((t) => short(t.name) === "aide_observer_end_session");
	assert(bootCalls.length === 0, `boot ran after HALT: ${bootCalls.map((t) => short(t.name)).join(", ")}`);
	assert(aideSkill.length === 0, "the aide skill was invoked after HALT");
	assert(endCalls.length === 0, "the agent ended a session without the user's approval");
	const extra = starts[0].result.split("\n").filter((l) => /claude:|^\s*-|session/i.test(l)).length;
	return `HALT names claude:${fake} (${extra} descriptive lines); no boot; no end_session; transcript ${r.transcriptPath}`;
});

await check("7h.approve", "claude -p with approval: end_session writes the mark, start then passes", ["7h.halt"], async () => {
	const fake = state.fakeHeadless;
	const r = await runClaude(
		`/aide\n\nIf the observer reports a HALT naming another open session of this project, I approve ending it: end it with aide_observer_end_session and start again. After the observer start passes, stop and give me the link; do nothing else.`,
		"run3-approve",
		30,
	);
	assert(!r.timedOut, `timed out; transcript ${r.transcriptPath}`);
	const ends = r.toolUses.filter((t) => short(t.name) === "aide_observer_end_session");
	assert(ends.length > 0, `aide_observer_end_session never called; transcript ${r.transcriptPath}`);
	assert(existsSync(endedMark(fake)), `no ended mark for ${fake} at ${endedMark(fake)}`);
	const starts = r.toolUses.filter((t) => short(t.name) === "aide_observer_start");
	const last = starts[starts.length - 1];
	assert(last && /^Observer (already )?running at /.test(last.result ?? ""), `last start replied: ${last?.result?.split("\n")[0]}`);
	return `${ends.map((e) => e.result).join("; ")}; ${starts.length} start call(s), last passed; transcript ${r.transcriptPath}`;
});

// 10. Legacy-root move (Windows) -------------------------------------------------
// One packed server with AIDEMD_HOME unset and a fake home + fake LOCALAPPDATA,
// both under the temp root: aide_observer_start must move the old
// %LOCALAPPDATA%\aidemd runtime files into <home>\.aidemd, byte for byte, and
// delete the old observer.json and observer-token.
console.log("\n[10] legacy-root move");
await check("10.move", "Windows: start moves %LOCALAPPDATA%\\aidemd into <home>\\.aidemd once", ["2.resolve", "3.init"], async () => {
	if (!IS_WIN) throw skip(`not Windows (${process.platform}): the legacy %LOCALAPPDATA%\\aidemd root and its move exist only on Windows`);
	const fakeHome = join(ROOT, "home");
	const fakeLa = join(ROOT, "la");
	const oldRoot = join(fakeLa, "aidemd");
	const newRoot = join(fakeHome, ".aidemd");
	mkdirSync(fakeHome, { recursive: true });
	const { root: drive } = parsePath(fakeHome);
	const env = {
		...ISO_ENV,
		USERPROFILE: fakeHome,
		HOMEDRIVE: drive.replace(/\\$/, ""),
		HOMEPATH: fakeHome.slice(drive.length - 1),
		LOCALAPPDATA: fakeLa,
	};
	delete env.AIDEMD_HOME;
	// Never let this check see the real home or app data.
	assert(!REAL_ROOTS.some(([, r]) => [oldRoot, newRoot].some((p) => resolve(p).toLowerCase() === resolve(r).toLowerCase())), "fake roots collide with a real root");
	const probe = spawnSync(process.execPath, ["-e", "process.stdout.write(require('os').homedir())"], { env, encoding: "utf8", windowsHide: true });
	assert(resolve(probe.stdout).toLowerCase() === resolve(fakeHome).toLowerCase(), `os.homedir() in the child env is ${probe.stdout}, not ${fakeHome}`);

	// Seed the old root: one session log, its ended mark, an ended presence, the old record and token.
	const sid = "20260101T000000000Z-rcmove";
	const claudeId = `rc-move-${randomUUID().slice(0, 8)}`;
	const seeded = {
		[join(PROJECT_KEY, "events", `${sid}.jsonl`)]:
			JSON.stringify({ v: 1, seq: 1, sessionId: sid, kind: "session_started", at: "2026-01-01T00:00:00.000Z", projectRoot: PROJECT }) + "\n",
		[join(PROJECT_KEY, "ended", `${sid}.json`)]:
			JSON.stringify({ v: 1, sessionId: sid, endedAt: "2026-01-01T00:05:00.000Z", endedBy: "user", bySessionId: "20260101T000000000Z-other0" }) + "\n",
		[join(PROJECT_KEY, "presence", `${claudeId}.json`)]: JSON.stringify({
			v: 1,
			claudeSessionId: claudeId,
			sessionId: sid,
			state: "ended",
			at: "2026-01-01T00:05:00.000Z",
			hookEvent: "SessionEnd",
		}),
	};
	for (const [rel, text] of Object.entries(seeded)) {
		mkdirSync(dirname(join(oldRoot, rel)), { recursive: true });
		writeFileSync(join(oldRoot, rel), text);
	}
	writeFileSync(join(oldRoot, "observer.json"), JSON.stringify({ address: "http://127.0.0.1:1", token: "0".repeat(64), pid: 999999, version: "0.0.1" }));
	writeFileSync(join(oldRoot, "observer-token"), "0".repeat(64));

	const client = new McpClient("move", PROJECT, env);
	let replies = [];
	try {
		await client.start();
		const started = await client.call("aide_observer_event", { kind: "session_started", projectRoot: PROJECT, kanbanTag: "release-check" });
		const first = await client.call("aide_observer_start", {}, 60_000);
		replies.push(first.text.split("\n")[0].replace(/token=[0-9a-f]+/, "token=…"));
		writeFileSync(join(LOGS, "move-start-1.txt"), `${started.text}\n---\n${first.text}`);
		const problems = [];
		for (const [rel, text] of Object.entries(seeded)) {
			const moved = join(newRoot, rel);
			if (!existsSync(moved)) problems.push(`missing ${moved}`);
			else if (sha(readFileSync(moved)) !== sha(text)) problems.push(`bytes differ ${moved}`);
			if (existsSync(join(oldRoot, rel))) problems.push(`old copy left ${join(oldRoot, rel)}`);
		}
		for (const name of ["observer.json", "observer-token"]) if (existsSync(join(oldRoot, name))) problems.push(`old ${name} left`);
		assert(problems.length === 0, `after the first start:\n${problems.join("\n")}`);
		const before = snapshot(newRoot);
		const second = await client.call("aide_observer_start", {}, 60_000);
		replies.push(second.text.split("\n")[0].replace(/token=[0-9a-f]+/, "token=…"));
		writeFileSync(join(LOGS, "move-start-2.txt"), second.text);
		const changes = diffSnapshots(before, snapshot(newRoot));
		assert(changes.length === 0, `second start changed the new root:\n${changes.join("\n")}`);
		return `${Object.keys(seeded).length} files moved byte-identical into ${newRoot}; old observer.json + observer-token gone; second start changed nothing. Replies: ${replies.join(" | ")}`;
	} finally {
		await client.stop();
		const rec = join(newRoot, "observer.json");
		if (existsSync(rec)) {
			try {
				const { pid, address } = readJson(rec);
				const port = Number(new URL(address).port);
				if (pid !== realBefore.observer?.pid && pid !== realBefore.listenPid && !(realBefore.listenPid && port === realBefore.realPort)) killTree(pid);
			} catch {
				/* unreadable record: nothing to stop */
			}
		}
	}
});

// 11. Upgrade from the previous release --------------------------------------
// A project set up by the version users have today (the latest published one, or
// AIDE_RC_PREVIOUS) is upgraded by the packed build, the way /aide:upgrade does it:
// aide_info flags what is behind, the aide_upgrade summary lists the drift, every
// package-owned category is applied, and afterwards nothing is outdated, the new
// files arrive byte-identical and the user's own files are untouched. The previous
// version lives in its own temp prefix; it never sees the packed one.
console.log("\n[11] upgrade from the previous release");
const PREV_PREFIX = join(ROOT, "prev-prefix");
const PREV_BIN = IS_WIN ? PREV_PREFIX : join(PREV_PREFIX, "bin");
const PREV_PKG_DIR = IS_WIN ? join(PREV_PREFIX, "node_modules", ...PKG.split("/")) : join(PREV_PREFIX, "lib", "node_modules", ...PKG.split("/"));
const PREV_ENV = withPath(
	{ ...ISO_ENV, npm_config_prefix: PREV_PREFIX, NPM_CONFIG_PREFIX: PREV_PREFIX },
	[PREV_BIN, getPath(BASE_ENV)].join(IS_WIN ? ";" : ":"),
);
const UP_PROJECT = join(ROOT, "rc-project-upgrade");
// Categories /aide:upgrade settles with the user rather than by a plain apply.
const INTERACTIVE_CATEGORIES = new Set(["mcp", "brain", "ide"]);
const upgradeSummary = async (client) => {
	const r = await client.call("aide_upgrade", {}, 120_000);
	assert(!r.isError, `aide_upgrade summary errored: ${r.text.slice(0, 300)}`);
	return JSON.parse(r.text);
};
const drifted = (cat) => cat.files.filter((f) => f.status === "differs" || f.status === "missing");

await check("11.prev", "previous release installed into its own temp prefix", [], async () => {
	const wanted = process.env.AIDE_RC_PREVIOUS?.trim();
	let prev = wanted;
	if (!prev) {
		const view = await run("npm", ["view", PKG, "version"], { cwd: ROOT, env: BASE_ENV, label: "npm-view-prev" });
		if (view.code !== 0) throw skip(`npm view ${PKG} failed (offline?): ${view.stderr.trim().slice(0, 120)}`);
		prev = view.stdout.trim();
	}
	mkdirSync(PREV_PREFIX, { recursive: true });
	const r = await run("npm", ["install", "-g", `${PKG}@${prev}`, "--prefix", PREV_PREFIX], { cwd: ROOT, env: BASE_ENV, timeout: 600_000, label: "install-prev" });
	assert(r.code === 0, `npm install ${PKG}@${prev} exited ${r.code}; see ${r.log}`);
	const installed = readJson(join(PREV_PKG_DIR, "package.json")).version;
	assert(installed === prev, `installed ${installed}, wanted ${prev}`);
	state.prevVersion = prev;
	return `${PKG}@${prev} in ${PREV_PKG_DIR} (packed is ${packedVersion}${prev === packedVersion ? "; same number, the packed content is newer" : ""})`;
});
await check("11.prev-init", "previous release's init sets up a project", ["11.prev"], async () => {
	seedProject(UP_PROJECT);
	// A user's own files the upgrade must never touch.
	mkdirSync(join(UP_PROJECT, "src", "feature"), { recursive: true });
	writeFileSync(join(UP_PROJECT, "src", "feature", ".aide"), "---\nscope: src/feature\nalignment: unreviewed\ndescription: A user-authored spec.\n---\n");
	writeFileSync(join(UP_PROJECT, "src", "feature", "index.ts"), "export default function feature() {}\n");
	const r = await run(join(PREV_BIN, IS_WIN ? "aidemd-mcp.cmd" : "aidemd-mcp"), ["init", "--brain", "obsidian"], { cwd: UP_PROJECT, env: PREV_ENV, label: "init-prev", timeout: 180_000 });
	writeFileSync(join(ROOT, "init-prev.txt"), r.stdout + r.stderr);
	assert(r.code === 0, `previous init exited ${r.code}; see ${join(ROOT, "init-prev.txt")}`);
	state.userFilesBefore = {
		"package.json": sha(readFileSync(join(UP_PROJECT, "package.json"), "utf8")),
		"src/feature/.aide": sha(readFileSync(join(UP_PROJECT, "src", "feature", ".aide"), "utf8")),
		"src/feature/index.ts": sha(readFileSync(join(UP_PROJECT, "src", "feature", "index.ts"), "utf8")),
		".aide/config/brain.aide": sha(readFileSync(join(UP_PROJECT, ".aide", "config", "brain.aide"), "utf8")),
		".aide/session.aide": sha(readFileSync(join(UP_PROJECT, ".aide", "session.aide"), "utf8")),
	};
	return `v${state.prevVersion} init exit 0; log ${join(ROOT, "init-prev.txt")}`;
});
await check("11.detect", "packed aide_info and aide_upgrade see the previous project as behind", ["11.prev-init", "2.resolve"], async () => {
	const client = new McpClient("upgrade-detect", UP_PROJECT);
	try {
		await client.start();
		const info = await client.call("aide_info", {}, 90_000);
		writeFileSync(join(LOGS, "aide_info-upgrade-before.txt"), info.text);
		const outdated = outdatedOf(info.text);
		assert(outdated, `no outdated array; see ${join(LOGS, "aide_info-upgrade-before.txt")}`);
		const summary = await upgradeSummary(client);
		writeFileSync(join(LOGS, "aide_upgrade-summary-before.json"), JSON.stringify(summary, null, 2));
		const reference = summary.categories.find((c) => c.category === "reference");
		const shipped = listFilesUnder(join(REPO, ".aide", "reference")).filter((f) => f.endsWith(".md")).map((f) => relative(join(REPO, ".aide", "reference"), f));
		if (reference) assert(reference.files.length === shipped.length, `reference lists ${reference.files.length} pages, the package ships ${shipped.length}`);
		state.toApply = summary.categories.filter((c) => !INTERACTIVE_CATEGORIES.has(c.category) && drifted(c).length > 0).map((c) => c.category);
		const behind = summary.categories.filter((c) => drifted(c).length > 0).map((c) => `${c.category}:${drifted(c).length}`);
		return `outdated ${outdated.length} key(s); drifted ${behind.join(", ") || "none"}; will apply ${state.toApply.join(", ") || "nothing"}`;
	} finally {
		await client.stop();
	}
});
await check("11.apply", "every package-owned category applies cleanly", ["11.detect"], async () => {
	const client = new McpClient("upgrade-apply", UP_PROJECT);
	const applied = [];
	try {
		await client.start();
		for (const category of state.toApply) {
			const r = await client.call("aide_upgrade", { category }, 120_000);
			writeFileSync(join(LOGS, `aide_upgrade-apply-${category}.txt`), r.text);
			assert(!r.isError, `${category} apply errored: ${r.text.slice(0, 300)}`);
			const cat = JSON.parse(r.text).categories?.find((c) => c.category === category);
			if (cat?.summary) {
				assert(cat.summary.differs === 0 && cat.summary.missing === 0, `${category} left ${cat.summary.differs} differs / ${cat.summary.missing} missing after apply`);
				applied.push(`${category} (+${cat.summary.created} ~${cat.summary.updated})`);
			} else {
				applied.push(category);
			}
		}
		return applied.join(", ") || "nothing to apply";
	} finally {
		await client.stop();
	}
});
await check("11.after", "after the upgrade nothing is behind, new files are byte-identical, user files untouched", ["11.apply"], async () => {
	const client = new McpClient("upgrade-after", UP_PROJECT);
	try {
		await client.start();
		const summary = await upgradeSummary(client);
		writeFileSync(join(LOGS, "aide_upgrade-summary-after.json"), JSON.stringify(summary, null, 2));
		const left = summary.categories.filter((c) => state.toApply.includes(c.category) && drifted(c).length > 0);
		assert(left.length === 0, `still drifted after apply: ${left.map((c) => `${c.category}: ${drifted(c).map((f) => f.name).join(", ")}`).join("; ")}`);
		const info = await client.call("aide_info", {}, 90_000);
		writeFileSync(join(LOGS, "aide_info-upgrade-after.txt"), info.text);
		const outdated = outdatedOf(info.text);
		assert(outdated && outdated.length === 0, `aide_info still lists outdated ${JSON.stringify(outdated)}`);
		// The reference set arrives byte-identical to what the package ships.
		const shipped = listFilesUnder(join(REPO, ".aide", "reference")).filter((f) => f.endsWith(".md")).map((f) => relative(join(REPO, ".aide", "reference"), f));
		for (const rel of shipped) {
			const host = join(UP_PROJECT, ".aide", "reference", rel);
			assert(existsSync(host), `reference page missing after upgrade: ${rel}`);
			assert(readFileSync(host, "utf8") === readFileSync(join(REPO, ".aide", "reference", rel), "utf8"), `reference page differs after upgrade: ${rel}`);
		}
		const touched = Object.entries(state.userFilesBefore).filter(([rel, h]) => sha(readFileSync(join(UP_PROJECT, rel), "utf8")) !== h).map(([rel]) => rel);
		assert(touched.length === 0, `upgrade changed user-owned files: ${touched.join(", ")}`);
		return `0 outdated; ${shipped.length} reference pages byte-identical; ${Object.keys(state.userFilesBefore).length} user files unchanged`;
	} finally {
		await client.stop();
	}
});

// ---------------------------------------------------------------------------
// Teardown, real-setup comparison, report
// ---------------------------------------------------------------------------

console.log("\n[teardown]");
for (const pid of mcpChildren) killTree(pid);
let stoppedObserver = "no observer record in the temp AIDE root";
if (existsSync(observerFile)) {
	const rec = readJson(observerFile);
	const port = Number(new URL(rec.address).port);
	if (rec.pid === realBefore.observer?.pid || rec.pid === realBefore.listenPid || (realBefore.listenPid && port === realBefore.realPort)) {
		stoppedObserver = `NOT stopping pid ${rec.pid}: it matches the real observer (${rec.address})`;
	} else {
		killTree(rec.pid);
		await sleep(500);
		stoppedObserver = `stopped test observer pid ${rec.pid} (${rec.address}); alive after: ${pidAlive(rec.pid)}`;
	}
}
console.log(`  ${stoppedObserver}`);

const realAfter = realBaseline();
writeFileSync(join(ROOT, "real-baseline-after.json"), JSON.stringify(realAfter, null, 2));
await check("9.real", "real global install, real observer and real app data untouched", [], async () => {
	// A real observer listening on the default port must have a readable record; without it this
	// check would compare nothing for the observer and pass vacuously (seen 2026-11-25 in the
	// desktop app's terminal panel, where the record at the expected path could not be read).
	const looked = REAL_ROOTS.map(([name, dir]) => `${join(dir, "observer.json")} (${name})`).join(" and ");
	for (const [when, snap] of [["before", realBefore], ["after", realAfter]]) {
		assert(
			!(snap.listenPid && !snap.observer),
			`cannot verify the real observer (${when}): port ${snap.realPort} is listening (pid ${snap.listenPid}) but no record was readable at ${looked}. ` +
				`Likely cause: an observer started inside the Claude desktop app by an AIDE version from before AIDEMD_HOME keeps its record in the app's private AppData ` +
				`(the MSIX package redirects %LOCALAPPDATA% writes into Packages\\Claude_<id>\\LocalCache\\Local), which a standalone terminal cannot see. ` +
				`Run the check from inside the app, or restart that observer after upgrading.`,
		);
	}
	assert(realAfter.npmLs === realBefore.npmLs, `npm ls -g changed:\n${realBefore.npmLs}\n->\n${realAfter.npmLs}`);
	assert(realAfter.listenPid === realBefore.listenPid, `port ${realBefore.realPort} listener pid ${realBefore.listenPid} -> ${realAfter.listenPid}`);
	const notes = [];
	for (const [name] of REAL_ROOTS) {
		const b = realBefore.roots[name];
		const a = realAfter.roots[name];
		assert(JSON.stringify(a.observer) === JSON.stringify(b.observer), `real ${name} observer.json changed: ${JSON.stringify(b.observer)} -> ${JSON.stringify(a.observer)}`);
		assert(a.testFolders.length === 0, `test project folders in the real ${name} root ${a.dir}: ${a.testFolders.join(", ")}`);
		assert(!existsSync(join(a.dir, PROJECT_KEY)), `test key folder ${PROJECT_KEY} in the real ${name} root ${a.dir}`);
		notes.push(`${name} ${a.dir}: observer.json ${a.observer ? `mtime ${a.observer.mtime} sha ${a.observer.sha} pid ${a.observer.pid}` : "absent"}, no test folders`);
	}
	return `npm ls -g: ${realAfter.npmLs.split(/\r?\n/).pop().trim()}; record judged from the ${realAfter.observerSource ?? "(none)"} root; port ${realAfter.realPort} pid ${realAfter.listenPid}\n${notes.join("\n")}`;
});

const totalMs = Date.now() - t0;
const pad = (s, n) => String(s).padEnd(n);
console.log("\n" + "=".repeat(100));
console.log(`AIDE release check  packed ${PKG}@${packedVersion ?? "?"}  (${(totalMs / 1000).toFixed(1)} s)`);
console.log(`temp root: ${ROOT}`);
console.log("=".repeat(100));
console.log(`${pad("STATUS", 7)}${pad("CHECK", 14)}${pad("TIME", 9)}DESCRIPTION / EVIDENCE`);
for (const r of results) {
	console.log(`${pad(r.status, 7)}${pad(r.id, 14)}${pad((r.ms / 1000).toFixed(1) + "s", 9)}${r.name}`);
	for (const line of String(r.evidence).split("\n")) if (line.trim()) console.log(`${" ".repeat(30)}${line}`);
}
const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
console.log("=".repeat(100));
console.log(`PASS ${counts.PASS ?? 0}  FAIL ${counts.FAIL ?? 0}  SKIP ${counts.SKIP ?? 0}`);
writeFileSync(join(ROOT, "report.json"), JSON.stringify({ packedVersion, root: ROOT, totalMs, results, realBefore, realAfter, stoppedObserver }, null, 2));

if (KEEP) {
	console.log(`kept: ${ROOT}`);
} else {
	try {
		rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
		console.log(`removed: ${ROOT}`);
	} catch (e) {
		console.log(`could not fully remove ${ROOT}: ${e.message}`);
	}
}
process.exit((counts.FAIL ?? 0) > 0 ? 1 : 0);
