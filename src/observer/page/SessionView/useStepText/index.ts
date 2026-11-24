import fetchFile from "@/observer/page/api/fetchFile/index.js";
import useFetched from "@/observer/page/shared/useFetched/index.js";
import type { StepSource } from "@/observer/page/types/index.js";
import pickStepText from "./pickStepText/index.js";

/**
 * The running Build step's own words, read from its plan file once per (file, step): null with no
 * source, while the file loads, when the read fails (the card then shows the step bar without
 * words, never an error) and when the plan has no such step.
 */
export default function useStepText({ token, projectKey, source }: { token: string; projectKey: string; source: StepSource | null }): string | null {
	const fetched = useFetched({
		key: source === null ? "" : `${source.file}#${source.step}`,
		load: source === null ? null : () => fetchFile({ token, projectKey, path: source.file }),
	});
	if (source === null || fetched.state !== "ready") return null;
	return pickStepText({ text: fetched.data.text, step: source.step });
}
