import Inline from "./Inline/index.js";
import parseBlocks from "./parseBlocks/index.js";

/**
 * The small markdown the session record and drawer carry: paragraphs, bulleted and numbered lists,
 * `**bold**` and `` `code` ``. Built as React elements from text, so raw HTML in the source prints
 * as text and nothing in it can run. The parent supplies the wrapping section.
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
				const items = block.items.map((item, itemIndex) => (
					<li key={itemIndex}>
						<Inline text={item} />
					</li>
				));
				return block.type === "ul" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
			})}
		</>
	);
}
