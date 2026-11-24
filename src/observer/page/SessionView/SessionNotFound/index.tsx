import Notice from "@/observer/page/shared/Notice/index.js";

/**
 * What a link to a session the observer has no recording of shows under the header: one calm
 * notice (not an error, since nothing broke) pointing at All projects, which the header's
 * breadcrumb links to. No pipeline, tree or history is drawn.
 */
export default function SessionNotFound() {
	return (
		<main id="main" className="av-body">
			<div className="av-center">
				<Notice tone="calm" icon="folder-off" iconSize="xl" heading="Session not found">
					<p>This observer has no recording of this session. It may have been deleted. Open All projects to see what is recorded.</p>
				</Notice>
			</div>
		</main>
	);
}
