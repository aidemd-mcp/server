import type { CSSProperties } from "react";

/**
 * The build step bar: one segment per plan step, the finished ones green, the running ones blue and
 * the rest empty, so progress reads by position and length as well as colour. It is one image to
 * assistive technology, named by `label` (`Step 4 of 9`). `--n` sets the column count the
 * stylesheet repeats (it defaults to the handoff's nine), through CSSOM, which the page's CSP allows.
 */
export default function StepBar({ total, done, running, label }: { total: number; done: number; running: number; label: string }) {
	return (
		<div className="av-steps" role="img" aria-label={label} style={{ "--n": total } as CSSProperties}>
			{Array.from({ length: total }, (_, index) => (
				<i key={index} className={index < done ? "d" : index < done + running ? "r" : undefined} />
			))}
		</div>
	);
}
