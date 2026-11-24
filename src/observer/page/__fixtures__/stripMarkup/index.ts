const ENTITIES: Record<string, string> = { "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&amp;": "&" };

/**
 * The text a static-markup string reads as: React's `<!-- -->` text separators and every tag removed,
 * the entities React writes decoded. Lets component tests assert the copy a user reads, not its markup.
 */
export default function stripMarkup(html: string): string {
	return html
		.replace(/<!-- -->/g, "")
		.replace(/<[^>]*>/g, "")
		.replace(/&#x27;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ENTITIES[entity] ?? entity);
}
