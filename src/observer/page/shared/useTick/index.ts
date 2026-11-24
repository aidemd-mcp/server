import { useEffect, useState } from "react";

/**
 * A one-second ticker for elapsed counters: the returned count grows every second while `live`,
 * and the interval is cleared when `live` changes or the component unmounts.
 */
export default function useTick(live: boolean): number {
	const [ticks, setTicks] = useState(0);
	useEffect(() => {
		if (!live) return;
		const id = setInterval(() => setTicks((value) => value + 1), 1000);
		return () => clearInterval(id);
	}, [live]);
	return ticks;
}
