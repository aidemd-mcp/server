import brainContract from "@/service/brainContract/index.js";
import type { BrainContractListing } from "@/types/index.js";

/**
 * Contract listing for `aide_brain` with `source: "contract"`: every required
 * section of the brain config, in contract order, as its marker, role and
 * purpose. Carries no section text, no launcher entry and no seed path, so an
 * agent learns what a config must contain without receiving any example.
 *
 * Takes no `root` and performs no I/O.
 */
export default function listContract(): BrainContractListing {
	return {
		sections: brainContract.map(({ marker, role, purpose }) => ({ marker, role, purpose })),
	};
}
