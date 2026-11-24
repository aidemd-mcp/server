import { useEffect } from "react";

/** Sets `document.title` to `title` whenever it changes. */
export default function useDocumentTitle({ title }: { title: string }): void {
	useEffect(() => {
		document.title = title;
	}, [title]);
}
