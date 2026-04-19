import ts from "typescript";
import { extname } from "node:path";

/** A symbol extracted from a source file, using absolute filePath. The orchestrator converts to relative. */
export interface ParsedSymbol {
	name: string;
	kind: "function" | "method" | "arrow" | "class" | "interface" | "type-alias";
	file: string;
	line: number;
	signature: string;
	jsdoc: {
		description: string;
		tags: Array<{ tag: string; text: string }>;
	} | null;
}

/** Map a file extension to the TS ScriptKind used by createSourceFile. */
function resolveScriptKind(filePath: string): ts.ScriptKind {
	const ext = extname(filePath).toLowerCase();
	if (ext === ".tsx") return ts.ScriptKind.TSX;
	if (ext === ".jsx") return ts.ScriptKind.JSX;
	if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

/**
 * Truncate a declaration's text before its body opening brace `{`.
 * Skips over `<` (generics) and `(` (parameter lists) to find the
 * first `{` at depth 0 that opens the function/class body.
 * Returns the full text unchanged when no body brace is found.
 */
function truncateBeforeBody(text: string): string {
	let depth = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "<" || ch === "(") {
			depth++;
			continue;
		}
		if (ch === ")") {
			depth--;
			continue;
		}
		if (ch === ">") {
			// `=>` is the fat-arrow token, not a generic closer — skip without decrementing.
			if (i > 0 && text[i - 1] === "=") continue;
			depth--;
			continue;
		}
		if (ch === "{" && depth === 0) {
			return text.slice(0, i).trimEnd();
		}
	}
	return text;
}

/** Parse a raw JSDoc comment string into description and tags. Returns null when blank. */
function parseJsDocText(raw: string): { description: string; tags: Array<{ tag: string; text: string }> } | null {
	// Strip /** ... */ wrapper and leading * per line
	const stripped = raw
		.replace(/^\/\*\*/, "")
		.replace(/\*\/$/, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\*\s?/, ""))
		.join("\n")
		.trim();

	if (!stripped) return null;

	const tagPattern = /@(\w+)\s*([\s\S]*?)(?=@\w|\s*$)/g;
	const tags: Array<{ tag: string; text: string }> = [];
	let descriptionEnd = stripped.length;

	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(stripped)) !== null) {
		if (descriptionEnd === stripped.length) descriptionEnd = match.index;
		tags.push({ tag: match[1], text: match[2].trim() });
	}

	const description = stripped.slice(0, descriptionEnd).trim();
	if (!description && tags.length === 0) return null;

	return { description, tags };
}

/** Extract JSDoc text from a node's leading trivia comments. */
function extractJsDoc(node: ts.Node, sourceText: string): { description: string; tags: Array<{ tag: string; text: string }> } | null {
	const jsDocNodes = ts.getJSDocCommentsAndTags(node);
	for (const jsDocNode of jsDocNodes) {
		if (ts.isJSDoc(jsDocNode)) {
			const start = jsDocNode.getFullStart();
			const end = jsDocNode.getEnd();
			const raw = sourceText.slice(start, end).trim();
			const result = parseJsDocText(raw);
			if (result) return result;
		}
	}
	return null;
}

/** Get the 1-based line number for a node's position in the source file. */
function getLine(sourceFile: ts.SourceFile, node: ts.Node): number {
	const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
	return line + 1;
}

/** Extract a name string from a BindingName, or return null. */
function nameText(name: ts.BindingName | ts.PropertyName | ts.EntityName | undefined): string | null {
	if (!name) return null;
	if (ts.isIdentifier(name)) return name.text;
	return null;
}

/**
 * Parse a TypeScript/JavaScript source file and extract all named symbols.
 * Uses syntax-only parsing (no full program) — no tsconfig required.
 * Returns one ParsedSymbol per discovered declaration.
 */
export default function parseSymbols(source: string, filePath: string): ParsedSymbol[] {
	const scriptKind = resolveScriptKind(filePath);
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, /* setParentNodes */ true, scriptKind);

	const symbols: ParsedSymbol[] = [];

	function visit(node: ts.Node): void {
		// FunctionDeclaration
		if (ts.isFunctionDeclaration(node) && node.name) {
			const name = node.name.text;
			const fullText = source.slice(node.getStart(), node.getEnd());
			symbols.push({
				name,
				kind: "function",
				file: filePath,
				line: getLine(sourceFile, node),
				signature: truncateBeforeBody(fullText),
				jsdoc: extractJsDoc(node, source),
			});
		}

		// MethodDeclaration
		else if (ts.isMethodDeclaration(node)) {
			const name = nameText(node.name);
			if (name) {
				const fullText = source.slice(node.getStart(), node.getEnd());
				symbols.push({
					name,
					kind: "method",
					file: filePath,
					line: getLine(sourceFile, node),
					signature: truncateBeforeBody(fullText),
					jsdoc: extractJsDoc(node, source),
				});
			}
		}

		// ClassDeclaration — truncate before body but append { ... } so the agent
		// knows members exist without seeing the full implementation.
		else if (ts.isClassDeclaration(node) && node.name) {
			const name = node.name.text;
			const fullText = source.slice(node.getStart(), node.getEnd());
			const truncated = truncateBeforeBody(fullText);
			// If truncation actually removed the body, indicate members exist.
			const signature = truncated.length < fullText.trimEnd().length ? `${truncated} { ... }` : truncated;
			symbols.push({
				name,
				kind: "class",
				file: filePath,
				line: getLine(sourceFile, node),
				signature,
				jsdoc: extractJsDoc(node, source),
			});
		}

		// InterfaceDeclaration — the body IS the contract; return full text so the
		// agent can read all members without opening the file.
		else if (ts.isInterfaceDeclaration(node)) {
			const name = node.name.text;
			const fullText = source.slice(node.getStart(), node.getEnd());
			symbols.push({
				name,
				kind: "interface",
				file: filePath,
				line: getLine(sourceFile, node),
				signature: fullText.trimEnd(),
				jsdoc: extractJsDoc(node, source),
			});
		}

		// TypeAliasDeclaration
		else if (ts.isTypeAliasDeclaration(node)) {
			const name = node.name.text;
			const fullText = source.slice(node.getStart(), node.getEnd());
			// Type aliases: full text (they have no body brace — they use `=`)
			symbols.push({
				name,
				kind: "type-alias",
				file: filePath,
				line: getLine(sourceFile, node),
				signature: fullText.trimEnd(),
				jsdoc: extractJsDoc(node, source),
			});
		}

		// VariableStatement: top-level const with ArrowFunction or FunctionExpression initializer
		else if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				const name = nameText(decl.name);
				if (!name || !decl.initializer) continue;

				const isArrow = ts.isArrowFunction(decl.initializer);
				const isFuncExpr = ts.isFunctionExpression(decl.initializer);
				if (!isArrow && !isFuncExpr) continue;

				// JSDoc is on the VariableStatement, not the initializer
				const jsdoc = extractJsDoc(node, source);
				const initText = source.slice(decl.initializer.getStart(), decl.initializer.getEnd());

				// Build signature: "const name = <arrow/func signature without body>"
				const arrowTruncated = truncateBeforeBody(initText);
				const beforeInit = source.slice(decl.getStart(), decl.initializer.getStart());
				const signature = (beforeInit + arrowTruncated).trimEnd();

				symbols.push({
					name,
					kind: "arrow",
					file: filePath,
					line: getLine(sourceFile, node),
					signature,
					jsdoc,
				});
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);

	return symbols;
}
