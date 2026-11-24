/** Leaves Home for the link a wait card, live row or project row carries. `navigate` defaults to the browser's own. */
export default function openSession({
	href,
	navigate = (url) => window.location.assign(url),
}: {
	href: string;
	navigate?: (url: string) => void;
}): void {
	navigate(href);
}
