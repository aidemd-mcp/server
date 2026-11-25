import Inline from "./Inline/index.js";
import parseBlocks from "./parseBlocks/index.js";

const CHECKBOX = /^\[( |x|X)\]\s+(.*)$/;

/** One list item: a `[ ]` / `[x]` item draws a checkbox (state in words for screen readers), anything else is inline text. */
function Item({ text }: { text: string }) {
	const box = CHECKBOX.exec(text);
	if (box === null) return <Inline text={text} />;
	const done = box[1] !== " ";
	return (
		<span className={done ? "md-check on" : "md-check"}>
			<span className="box" aria-hidden="true" />
			<span className="sr">{done ? "Done: " : "Open: "}</span>
			<Inline text={box[2] ?? ""} />
		</span>
	);
}

/**
 * The markdown the session record and drawer carry: paragraphs, bulleted and numbered lists (with
 * `[ ]` / `[x]` checkboxes), headings, fenced code blocks, `**bold**` and `` `code` ``. Built as React
 * elements from text, so raw HTML in the source prints as text and nothing in it can run. The parent
 * supplies the wrapping section.
 */
export default function Markdown({ markdown }: { markdown: string }) {
	return (
		<>
			{parseBlocks(markdown).map((block, index) => {
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
				if (block.type === "h") {
					return (
						<p key={index} className={`md-h l${Math.min(block.level, 4)}`}>
							<Inline text={block.text} />
						</p>
					);
				}
				const items = block.items.map((item, itemIndex) => (
					<li key={itemIndex}>
						<Item text={item} />
					</li>
				));
				return block.type === "ul" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
			})}
		</>
	);
}
