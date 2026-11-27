import Inline from "../../Inline/index.js";

const CHECKBOX = /^\[( |x|X)\]\s+(.*)$/;

/** One list item's text: a `[ ]` / `[x]` item draws a checkbox (state in words for screen readers), anything else is inline text. */
export default function Item({ text }: { text: string }) {
	const box = CHECKBOX.exec(text);
	if (box === null) return <Inline text={text} />;
	const done = box[1] !== " ";
	return (
		<span className={done ? "md-check on" : "md-check"}>
			<span className="box" aria-hidden="true" />
			<span className="sr">{done ? "Done: " : "Open: "}</span>
			<span className="t">
				<Inline text={box[2] ?? ""} />
			</span>
		</span>
	);
}
