import { useEffect, useState } from "react";

const NARROW_QUERY = "(max-width: 760px)";

/**
 * Whether the viewport is phone width (the handoff's 760px breakpoint): reads `matchMedia` on
 * first render and follows its `change` event until the component unmounts.
 */
export default function useNarrow(): boolean {
	const [narrow, setNarrow] = useState<boolean>(() => window.matchMedia(NARROW_QUERY).matches);

	useEffect(() => {
		const query = window.matchMedia(NARROW_QUERY);
		const onChange = (event: { matches: boolean }) => setNarrow(event.matches);
		setNarrow(query.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	return narrow;
}
