import { describe, expect, it } from "vitest";
import {
	LABEL_MAX,
	PATH_MAX,
	PROMPT_MAX,
	TEXT_MAX,
} from "@/service/observer/event/shared/limits/index.js";

describe("event field limits", () => {
	it("pins the four limits the stored events and the presence record rely on", () => {
		expect({ LABEL_MAX, PATH_MAX, TEXT_MAX, PROMPT_MAX }).toEqual({
			LABEL_MAX: 200,
			PATH_MAX: 1024,
			TEXT_MAX: 4000,
			PROMPT_MAX: 100_000,
		});
	});
});
