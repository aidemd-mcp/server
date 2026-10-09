import type { BrainSectionMarker } from "../index.js";

/**
 * Builds the open and close HTML-comment markers that bracket a brain-config
 * body section. This is the only place in `src/` that constructs the marker
 * byte sequence, so the parser's marker walker and provisionBrain's repair
 * blocks can never disagree on marker bytes.
 */
export default function toMarkerPair(marker: BrainSectionMarker): { open: string; close: string } {
	return {
		open: `<!-- aide-${marker}-start -->`,
		close: `<!-- aide-${marker}-end -->`,
	};
}
