import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join, extname, basename } from "node:path";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { marked } from "marked";

// ── Types ──────────────────────────────────────────────────────────────────

interface Document {
	displayName: string;
	markdownContent: string;
}

interface Section {
	label: string;
	documents: Document[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(process.cwd());

const SOURCE_DIRS = {
	methodologyDocs: join(PROJECT_ROOT, ".aide", "docs"),
	agentDefinitions: join(PROJECT_ROOT, ".claude", "agents", "aide"),
	commandDefinitions: join(PROJECT_ROOT, ".claude", "commands", "aide"),
	skillDefinitions: join(PROJECT_ROOT, ".claude", "skills"),
} as const;

const SECTION_LABELS = {
	methodologyDocs: "Methodology Docs",
	agentDefinitions: "Agent Definitions",
	commandDefinitions: "Command Definitions",
	skillDefinitions: "Skill Definitions",
} as const;

// ── File discovery ─────────────────────────────────────────────────────────

/**
 * Converts a kebab-case or snake_case filename (without extension) to Title Case.
 * Exists because not every source file has an H1 heading, and we still need a
 * human-readable name for the TOC.
 */
function kebabToTitleCase(stem: string): string {
	return stem
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Extracts the display name for the TOC from a markdown document. Prefers the
 * first H1 heading because that is the author's canonical title for the content.
 * Falls back to the filename stem so no document ever appears as an empty label.
 */
function extractDisplayName(markdownContent: string, filePath: string): string {
	const h1Match = markdownContent.match(/^#\s+(.+)$/m);
	if (h1Match) return h1Match[1].trim();

	const stem = basename(filePath, ".md");
	return kebabToTitleCase(stem);
}

/**
 * Returns the sorted list of `.md` filenames directly inside `dir`.
 * Sorting is alphabetical by filename so the document order is stable across
 * runs and OS file-system orderings.
 */
function listMarkdownFiles(dir: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && extname(e.name) === ".md" && e.name !== "index.md")
		.map((e) => e.name)
		.sort();
}

/**
 * Returns subdirectory names inside `dir`, sorted alphabetically. Used to
 * enumerate skill subdirectories in a deterministic order.
 */
function listSubdirectories(dir: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();
}

/**
 * Reads a markdown file and returns a Document. Throws on read failure rather
 * than silently returning empty content, which would produce a TOC entry with
 * no matching body — the spec's primary bad-example scenario.
 */
function readDocument(filePath: string): Document {
	const markdownContent = readFileSync(filePath, "utf-8");
	const displayName = extractDisplayName(markdownContent, filePath);
	return { displayName, markdownContent };
}

/**
 * Parses an index.md file and returns the ordered list of linked filenames.
 * Links are expected in markdown list format: `- [name](./file.md)`.
 * Returns null if no index.md exists in the directory.
 */
function parseIndexOrder(dir: string): string[] | null {
	const indexPath = join(dir, "index.md");
	let content: string;
	try {
		content = readFileSync(indexPath, "utf-8");
	} catch {
		return null;
	}

	const linkedFiles: string[] = [];
	const regex = /\[.*?\]\(\.\/([^)]+\.md)\)/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(content)) !== null) {
		linkedFiles.push(match[1]);
	}
	return linkedFiles.length > 0 ? linkedFiles : null;
}

/**
 * Discovers and reads all markdown documents in a flat directory. If an
 * index.md exists, documents are ordered to match the index's link order
 * (with any unlisted files appended alphabetically). Otherwise falls back
 * to alphabetical order by filename.
 */
function readFlatSection(dir: string): Document[] {
	const indexOrder = parseIndexOrder(dir);

	if (indexOrder) {
		const allFiles = new Set(listMarkdownFiles(dir));
		const ordered: string[] = [];

		for (const filename of indexOrder) {
			if (allFiles.has(filename)) {
				ordered.push(filename);
				allFiles.delete(filename);
			}
		}
		// Append any files not listed in the index
		Array.from(allFiles).sort().forEach((filename) => {
			ordered.push(filename);
		});

		return ordered.map((filename) => readDocument(join(dir, filename)));
	}

	const filenames = listMarkdownFiles(dir);
	return filenames.map((filename) => readDocument(join(dir, filename)));
}

/**
 * Discovers and reads all markdown documents in a directory that may contain
 * subdirectories (the skills directory has brain/ and study-playbook/).
 * Top-level files appear first (sorted), followed by each subdirectory's files
 * (subdirectories sorted, then filenames within each sorted). This grouping
 * matches the spec requirement and keeps the TOC readable.
 */
function readSkillsSection(dir: string): Document[] {
	const topLevelDocuments = readFlatSection(dir);

	const subdirectoryDocuments = listSubdirectories(dir).flatMap((subdirName) => {
		const subdirPath = join(dir, subdirName);
		return readFlatSection(subdirPath);
	});

	return [...topLevelDocuments, ...subdirectoryDocuments];
}

// ── Section assembly ───────────────────────────────────────────────────────

/**
 * Builds the complete in-memory representation of all AIDE source content.
 * The four sections correspond exactly to the four source directories defined
 * in the spec. Each section's documents follow index.md order where available,
 * falling back to alphabetical order.
 * Steps 3–5 consume this structure to produce HTML and then PDF output.
 */
function discoverContent(): Section[] {
	return [
		{
			label: SECTION_LABELS.methodologyDocs,
			documents: readFlatSection(SOURCE_DIRS.methodologyDocs),
		},
		{
			label: SECTION_LABELS.agentDefinitions,
			documents: readFlatSection(SOURCE_DIRS.agentDefinitions),
		},
		{
			label: SECTION_LABELS.commandDefinitions,
			documents: readFlatSection(SOURCE_DIRS.commandDefinitions),
		},
		{
			label: SECTION_LABELS.skillDefinitions,
			documents: readSkillsSection(SOURCE_DIRS.skillDefinitions),
		},
	];
}

// ── Cover page constants ────────────────────────────────────────────────────

const COVER_TITLE = "The AIDE Methodology Specification v1.0";
const COVER_AUTHOR = "Jacob Carpenter";
const COVER_ENTITY = "TetsuKodai Group LLC";
const COVER_COPYRIGHT = "© 2026 TetsuKodai Group LLC. All rights reserved.";
const COVER_DATE = "April 12, 2026";

// ── HTML rendering ──────────────────────────────────────────────────────────

/**
 * Renders a markdown string to HTML using marked with default options.
 * Default options handle code fences, tables, and nested lists without plugins.
 * Called once per document so each document's markdown is independently converted.
 */
function renderMarkdown(markdownContent: string): string {
	return marked.parse(markdownContent, { async: false });
}

/**
 * Builds the cover page as a standalone `<section>` with a page break after it.
 * The cover is rendered as its own PDF pass in step 4 so it carries no footer —
 * this section must remain structurally separate from the body to support that.
 */
function buildCoverHtml(): string {
	return `
<section class="cover">
  <h1>${COVER_TITLE}</h1>
  <p class="author">${COVER_AUTHOR}</p>
  <p class="entity">${COVER_ENTITY}</p>
  <p class="copyright">${COVER_COPYRIGHT}</p>
  <p class="date">Date of First Publication: ${COVER_DATE}</p>
</section>`;
}

/**
 * Builds the table of contents from the same in-memory section structure used
 * to render the body. Generating both from the same source guarantees that every
 * TOC entry has a corresponding body section — the spec's primary correctness
 * requirement (desired outcome #2, undesired outcome #2).
 */
function buildTocHtml(sections: Section[]): string {
	const sectionItems = sections
		.map((section) => {
			const documentItems = section.documents
				.map((doc) => `    <li>${doc.displayName}</li>`)
				.join("\n");
			return `  <h2>${section.label}</h2>\n  <ul>\n${documentItems}\n  </ul>`;
		})
		.join("\n");

	return `
<section class="toc" style="page-break-after: always;">
  <h1>Table of Contents</h1>
${sectionItems}
</section>`;
}

/**
 * Builds the full body HTML — one section heading per section, then each
 * document's heading and rendered markdown. A `page-break-before` on each
 * document heading ensures every document begins on a fresh page, which is
 * required for the copyright registration layout described in the spec.
 */
function buildBodyHtml(sections: Section[]): string {
	return sections
		.map((section) => {
			const documentHtml = section.documents
				.map(
					(doc) => `
<h2 style="page-break-before: always;">${doc.displayName}</h2>
${renderMarkdown(doc.markdownContent)}`,
				)
				.join("\n");

			return `
<section class="content-section">
  <h1>${section.label}</h1>
${documentHtml}
</section>`;
		})
		.join("\n");
}

/**
 * Assembles the full HTML document from cover, TOC, and body. Embeds all
 * typography and print styles in a single `<style>` block so the document
 * is self-contained — Puppeteer does not have access to external stylesheets
 * at the paths they would exist on disk.
 */
function buildHtml(sections: Section[]): string {
	const coverHtml = buildCoverHtml();
	const tocHtml = buildTocHtml(sections);
	const bodyHtml = buildBodyHtml(sections);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${COVER_TITLE}</title>
  <style>
    body {
      font-family: Georgia, serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    /* Cover page */
    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      page-break-after: always;
    }
    .cover h1 {
      font-size: 2.2em;
      margin-bottom: 0.5em;
    }
    .cover .author {
      font-size: 1.2em;
      margin: 0.25em 0;
    }
    .cover .entity {
      font-size: 1em;
      margin: 0.25em 0;
    }
    .cover .date {
      font-size: 1em;
      margin: 1em 0 0.25em;
      color: #555;
    }
    .cover .copyright {
      font-size: 0.9em;
      color: #555;
      margin: 0.25em 0;
    }

    /* Headings */
    h1 {
      font-size: 1.8em;
      page-break-after: avoid;
    }
    h2 {
      font-size: 1.4em;
      page-break-after: avoid;
    }
    h3 {
      font-size: 1.15em;
      page-break-after: avoid;
    }

    /* Code blocks */
    pre {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      page-break-inside: avoid;
    }

    /* Inline code */
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 1em;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
    }
    th {
      background: #f5f5f5;
    }

    /* TOC */
    .toc h1 {
      font-size: 1.8em;
    }
    .toc h2 {
      font-size: 1.2em;
      margin-bottom: 0.25em;
    }
    .toc ul {
      margin-top: 0;
      padding-left: 1.5em;
    }
    .toc li {
      margin: 0.2em 0;
    }
  </style>
</head>
<body>
${coverHtml}
${tocHtml}
${bodyHtml}
</body>
</html>`;
}

// ── PDF generation ──────────────────────────────────────────────────────────

const OUTPUT_DIR = join(PROJECT_ROOT, "dist");
const OUTPUT_PATH = join(OUTPUT_DIR, "aide-methodology.pdf");

const FOOTER_TEMPLATE = `<div style="font-size: 9px; width: 100%; display: flex; justify-content: space-between; padding: 0 40px;"><span>© 2026 TetsuKodai Group LLC. All rights reserved.</span><span>Page <span class="pageNumber"></span></span></div>`;

/**
 * Renders page 1 of the HTML document as a PDF buffer with no header or footer.
 * The cover page must be footer-free — Puppeteer cannot suppress the footer on
 * a per-page basis, so the cover is generated in a separate pass and merged later.
 */
async function generateCoverPdf(html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });
		const buffer = await page.pdf({
			format: "Letter",
			pageRanges: "1",
			printBackground: true,
		});
		return new Uint8Array(buffer);
	} finally {
		await browser.close();
	}
}

/**
 * Renders pages 2 onward of the HTML document as a PDF buffer with the copyright
 * footer and page numbers on every page. The `pageRanges: '2-'` skips the cover
 * so this PDF contains only the TOC and body — both carrying the footer.
 */
async function generateBodyPdf(html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });
		const buffer = await page.pdf({
			format: "Letter",
			pageRanges: "2-",
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: "<span></span>",
			footerTemplate: FOOTER_TEMPLATE,
			margin: { top: "40px", bottom: "60px", left: "40px", right: "40px" },
		});
		return new Uint8Array(buffer);
	} finally {
		await browser.close();
	}
}

/**
 * Merges the cover PDF and body PDF into a single document and writes it to the
 * output path. Uses pdf-lib's `copyPages` + `addPage` pattern so both source
 * documents remain independent and the merge is non-destructive.
 */
async function mergePdfs(
	coverPdf: Uint8Array,
	bodyPdf: Uint8Array,
	outputPath: string,
): Promise<void> {
	const coverDoc = await PDFDocument.load(coverPdf);
	const bodyDoc = await PDFDocument.load(bodyPdf);
	const mergedDoc = await PDFDocument.create();

	const coverPages = await mergedDoc.copyPages(
		coverDoc,
		coverDoc.getPageIndices(),
	);
	for (const page of coverPages) {
		mergedDoc.addPage(page);
	}

	const bodyPages = await mergedDoc.copyPages(bodyDoc, bodyDoc.getPageIndices());
	for (const page of bodyPages) {
		mergedDoc.addPage(page);
	}

	const mergedBytes = await mergedDoc.save();
	const { writeFileSync } = await import("node:fs");
	writeFileSync(outputPath, mergedBytes);
}

/**
 * Orchestrates the full PDF export: discovers content, builds HTML, runs the
 * two-pass PDF generation, merges the results, and writes the output file.
 * This is the single entry point for the script — called by main() at the bottom.
 */
async function exportPdf(): Promise<void> {
	mkdirSync(OUTPUT_DIR, { recursive: true });

	const sections = discoverContent();
	const html = buildHtml(sections);

	const coverPdf = await generateCoverPdf(html);
	const bodyPdf = await generateBodyPdf(html);

	await mergePdfs(coverPdf, bodyPdf, OUTPUT_PATH);

	console.log("PDF generated: " + OUTPUT_PATH);
}

exportPdf().catch((err) => {
	console.error(err);
	process.exit(1);
});
