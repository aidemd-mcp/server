import { Fragment } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import Inline from "@/observer/page/shared/Markdown/Inline/index.js";
import Markdown from "@/observer/page/shared/Markdown/index.js";
import type { DrawerBlockModel } from "@/observer/page/types/index.js";

/**
 * One section of the drawer: its `h4` (icon, heading, optional badge) and one body by type, with the
 * handoff's classes: `av-fm` for frontmatter, paragraphs, `out` lists, `av-pre`, `av-kv`, and the
 * `av-check` list for plan steps (`on`, `sub`, `cur`) and todo issues (`issue`, `on`). A check or
 * issue row says its state in words for screen readers (the box is decoration). The handoff's inline
 * one-off spacings are kept as `style` props, which the page's CSP allows.
 */
export default function DrawerBlock({ block }: { block: DrawerBlockModel }) {
	return (
		<section>
			<h4>
				<Icon name={block.icon} />
				{block.heading}
				{block.badge !== null && <span className={`av-badge ${block.badge.tone}`}>{block.badge.text}</span>}
			</h4>
			{block.type === "fm" && (
				<dl className="av-fm">
					{block.rows.map((row) => (
						<Fragment key={row.key}>
							<dt>{row.key}</dt>
							<dd>
								{row.value}
								{row.list !== null && (
									<ul className="out" style={{ marginTop: "2px" }}>
										{row.list.map((entry, index) => (
											<li key={index}>{entry}</li>
										))}
									</ul>
								)}
							</dd>
						</Fragment>
					))}
				</dl>
			)}
			{block.type === "text" &&
				block.paras.map((para, index) => (
					<p key={index} style={{ marginBottom: "8px" }}>
						<Inline text={para} />
					</p>
				))}
			{block.type === "list" && (
				<ul className="out">
					{block.items.map((item, index) => (
						<li key={index}>
							<Inline text={item} />
						</li>
					))}
				</ul>
			)}
			{block.type === "pre" && <div className="av-pre">{block.text}</div>}
			{block.type === "md" && (
				<div className="md-body">
					<Markdown markdown={block.markdown} />
				</div>
			)}
			{block.type === "kv" && (
				<dl className="av-kv">
					{block.rows.map((row, index) => (
						<Fragment key={index}>
							<dt>{row.key}</dt>
							<dd className={row.mono ? "mono" : undefined}>{row.value}</dd>
						</Fragment>
					))}
				</dl>
			)}
			{block.type === "check" && (
				<ol className="av-check">
					{block.items.map((item, index) => (
						<li key={index} className={joinClasses(item.done && "on", item.sub && "sub", item.current && "cur") || undefined}>
							<span className="ck" aria-hidden="true">
								{item.done && <Icon name="check" />}
							</span>
							<span className="no">{item.no}</span>
							<span className="tx">
								{item.text}
								<span className="sr">{item.done ? " (done)" : item.current ? " (in progress)" : " (not done)"}</span>
							</span>
						</li>
					))}
				</ol>
			)}
			{block.type === "issues" && (
				<ol className="av-check">
					{block.items.map((item, index) => (
						<li key={index} className={joinClasses("issue", item.done && "on")}>
							<span className="ck" aria-hidden="true">
								{item.done && <Icon name="check" />}
							</span>
							<span>
								{item.loc !== "" && <span className="loc">{item.loc}</span>}
								<span className="what">
									{item.text}
									<span className="sr">{item.done ? " (fixed)" : " (open)"}</span>
								</span>
							</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
