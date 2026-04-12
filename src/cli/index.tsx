#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { existsSync } from "node:fs";
import scan from "@/util/scan/index.js";
import buildTreeData from "@/cli/buildTreeData/index.js";
import App from "@/cli/App/index.js";

const root = process.argv[2] ?? process.cwd();

if (!existsSync(root)) {
	process.stderr.write(`aide-tree: path not found: ${root}\nUsage: aide-tree [project-root]\n`);
	process.exit(1);
}

const result = await scan(root, undefined, true);
const initialNodes = buildTreeData(result.files);

render(<App root={root} initialNodes={initialNodes} />);
