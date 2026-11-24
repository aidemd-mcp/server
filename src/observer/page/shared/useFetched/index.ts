import { useEffect, useState } from "react";
import type { ApiResult, Fetched } from "@/observer/page/types/index.js";

/**
 * Runs one API call when `key` first shows and again when it changes, and reports it as loading,
 * ready or error (the observer's own message). A result that arrives after the key changed or the
 * component unmounted is dropped. A null `load` runs nothing and stays loading.
 */
export default function useFetched<T>({ key, load }: { key: string; load: (() => Promise<ApiResult<T>>) | null }): Fetched<T> {
	const [result, setResult] = useState<{ key: string; fetched: Fetched<T> } | null>(null);

	useEffect(() => {
		if (load === null) return;
		let live = true;
		void load().then((response) => {
			if (!live) return;
			setResult({
				key,
				fetched: response.ok ? { state: "ready", data: response.data } : { state: "error", message: response.message },
			});
		});
		return () => {
			live = false;
		};
		// `load` is a fresh closure each render; `key` names what it loads.
	}, [key]);

	return result !== null && result.key === key ? result.fetched : { state: "loading" };
}
