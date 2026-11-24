import HomeView from "@/observer/page/HomeView/index.js";
import useRoute from "@/observer/page/route/useRoute/index.js";
import InvalidLink from "@/observer/page/shared/InvalidLink/index.js";
import ThemeRoot from "@/observer/page/shared/ThemeRoot/index.js";
import SessionView from "@/observer/page/SessionView/index.js";

/** The slice of `window.location` the route is read from; the browser's own when none is given. */
type AppLocation = { pathname: string; search: string };

/**
 * The page's root: reads the address and shows Home at `/`, the session view at
 * `/p/:project/s/:session`, and the invalid-link screen for anything else, including an address with
 * no token. Every screen sits in `ThemeRoot`, which owns the theme and the phone breakpoint; the
 * session view also gets its tab so the stylesheet can swap the main area and History on a phone.
 * `location` is for rendering a route without a browser (tests).
 */
export default function App({ location }: { location?: AppLocation } = {}) {
	const { route, setTab, openItem, closeItem } = useRoute({ location });
	if (route.kind === "home") {
		return (
			<ThemeRoot>
				<HomeView route={route} />
			</ThemeRoot>
		);
	}
	if (route.kind === "session") {
		return (
			<ThemeRoot tab={route.tab}>
				<SessionView route={route} setTab={setTab} openItem={openItem} closeItem={closeItem} />
			</ThemeRoot>
		);
	}
	return (
		<ThemeRoot>
			<InvalidLink />
		</ThemeRoot>
	);
}
