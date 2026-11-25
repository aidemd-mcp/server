import { useState } from "react";

/** One copyable value of the project info line. */
function CopyValue({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false);
	const copy = (): void => {
		void navigator.clipboard?.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	};
	return (
		<span className="pi-item">
			<span className="pi-k">{label}</span>
			<span className="mono">{value}</span>
			<button type="button" className="av-btn ghost pi-copy" aria-label={`Copy ${label.toLowerCase()}`} onClick={copy}>
				{copied ? "Copied" : "Copy"}
			</button>
		</span>
	);
}

/**
 * The project's details at the top of the Sessions tab: the folder the session reported and the
 * kanban tag, each with a copy button. Moved here from the header, where they were noise. Draws
 * nothing when neither is known.
 */
export default function ProjectInfo({ rootPath, kanbanTag }: { rootPath: string | null; kanbanTag: string | null }) {
	if (rootPath === null && kanbanTag === null) return null;
	return (
		<div className="av-projinfo">
			{rootPath !== null && <CopyValue label="Project folder" value={rootPath} />}
			{kanbanTag !== null && <CopyValue label="Kanban tag" value={kanbanTag} />}
		</div>
	);
}
