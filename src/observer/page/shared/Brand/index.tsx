import pageTitle from "@/observer/shared/pageTitle/index.js";

/** The header's mark and name: the "A" logo and the page's shared title copy. */
export default function Brand() {
	return (
		<div className="av-brand">
			<span className="av-logo" aria-hidden="true">
				A
			</span>
			{pageTitle}
		</div>
	);
}
