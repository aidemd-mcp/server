import Icon from "@/observer/page/shared/Icon/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import type { RecordModel } from "@/observer/page/types/index.js";
import RecordBody from "./RecordBody/index.js";

/**
 * The Record tab: an outline of jump links (a strip that scrolls inside itself on a phone) beside
 * the record. "Where this cycle stopped" is pinned first, the other sections follow in file order,
 * and a section with nothing in it reads as a calm line, never an error. A record that is missing or
 * unreadable is one calm notice carrying the reason.
 */
export default function RecordView({ record }: { record: RecordModel }) {
	if (record.kind !== "present") {
		return (
			<Notice tone="calm" icon="doc" iconSize="lg" heading="No session record">
				<p>{record.message}</p>
			</Notice>
		);
	}

	return (
		<div className="av-rec">
			<nav className="av-outline" aria-label="Record outline">
				<span className="o-h">Outline</span>
				{record.outline.map((entry, index) => (
					<a key={entry.id} href={`#${entry.id}`} className={index === 0 ? "on" : undefined}>
						{entry.pinned && <Icon name="pin" className="pin" />}
						{entry.label}
						<span className="c">{entry.count}</span>
					</a>
				))}
			</nav>
			<article className="av-doc">
				{record.pinned !== null && (
					<section className="av-pin" id={record.pinned.id}>
						<span className="pin-k">
							<Icon name="pin" />
							Pinned
						</span>
						<h3>{record.pinned.heading}</h3>
						<RecordBody section={record.pinned} />
					</section>
				)}
				{record.sections.map((section) => (
					<section key={section.id} id={section.id}>
						<h3>{section.heading}</h3>
						<RecordBody section={section} />
					</section>
				))}
			</article>
		</div>
	);
}
