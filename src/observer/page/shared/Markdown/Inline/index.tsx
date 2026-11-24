import parseInline from "@/observer/page/shared/Markdown/parseInline/index.js";

/** One line of inline markdown as elements: `**bold**` as `<b>`, `` `code` `` as the handoff's mono span, the rest as escaped text. */
export default function Inline({ text }: { text: string }) {
	return (
		<>
			{parseInline(text).map((node, index) => {
				if (node.type === "bold") return <b key={index}>{node.text}</b>;
				if (node.type === "code") return <span key={index} className="mono">{node.text}</span>;
				return node.text;
			})}
		</>
	);
}
