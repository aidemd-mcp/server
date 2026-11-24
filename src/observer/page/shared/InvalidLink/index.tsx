import AppHeader from "@/observer/page/shared/AppHeader/index.js";
import Brand from "@/observer/page/shared/Brand/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import SkipLink from "@/observer/page/shared/SkipLink/index.js";
import ThemeButton from "@/observer/page/shared/ThemeButton/index.js";
import useThemeContext from "@/observer/page/shared/useThemeContext/index.js";

/**
 * What any address without a valid token shows: the brand and theme switch only (no connection
 * pill), and the handoff's notice. Nothing else renders, so stale data can never pass for live data.
 */
export default function InvalidLink() {
	const { theme, toggle } = useThemeContext();
	return (
		<>
			<SkipLink target="main" />
			<AppHeader left={<Brand />} right={<ThemeButton theme={theme} onToggle={toggle} />} />
			<main id="main" className="av-body">
				<div className="av-center">
					<Notice icon="unlink" iconSize="xl" heading="This link is no longer valid">
						<p>
							The access link may have expired, or it was copied incompletely. Nothing is shown here so you don&apos;t
							mistake old data for live data.
						</p>
						<p>
							Ask the agent for a fresh viewer link — it prints one when a session starts — or open the most recent link
							it gave you.
						</p>
					</Notice>
				</div>
			</main>
		</>
	);
}
