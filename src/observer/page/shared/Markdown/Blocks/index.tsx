import type { MarkdownBlock } from "@/observer/page/types/index.js";
import Inline from "../Inline/index.js";
import Item from "./Item/index.js";

/**
 * Draws parsed markdown blocks as React elements: paragraphs, headings, fenced code, pipe tables (in a
 * wrapper that scrolls sideways on its own) and lists, each list item drawing the blocks nested under
 * it the same way.
 */
export default function Blocks({ blocks }: { blocks: readonly MarkdownBlock[] }) {
	return (
		<>
			{blocks.map((block, index) => {
				if (block.type === "p") {
					return (
						<p key={index}>
							<Inline text={block.text} />
						</p>
					);
				}
				if (block.type === "code") {
					return (
						<pre key={index} className="av-pre md-code">
							{block.text}
						</pre>
					);
				}
				if (block.type === "table") {
					const alignOf = (column: number) => block.align[column] ?? undefined;
					return (
						<div key={index} className="md-table">
							<table>
								<thead>
									<tr>
										{block.head.map((cell, column) => (
											<th key={column} style={{ textAlign: alignOf(column) }}>
												<Inline text={cell} />
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{block.rows.map((row, rowIndex) => (
										<tr key={rowIndex}>
											{row.map((cell, column) => (
												<td key={column} style={{ textAlign: alignOf(column) }}>
													<Inline text={cell} />
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					);
				}
				if (block.type === "h") {
					return (
						<p key={index} className={`md-h l${Math.min(block.level, 4)}`}>
							<Inline text={block.text} />
						</p>
					);
				}
				const items = block.items.map((item, itemIndex) => (
					<li key={itemIndex}>
						<Item text={item.text} />
						{item.blocks.length > 0 && <Blocks blocks={item.blocks} />}
					</li>
				));
				return block.type === "ul" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
			})}
		</>
	);
}
