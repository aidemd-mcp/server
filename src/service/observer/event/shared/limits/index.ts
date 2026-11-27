/**
 * Length limits of the observer's event fields. They live apart from the zod
 * schema so a contract the hook reaches (the presence record) can take its
 * path limit without loading zod (src/service/observer/brief.aide
 * commitments #103, #150). Contract file: named exports, no default export
 * (brief commitment #95).
 */

/** Longest accepted label: names, slugs, agent, module, gate, column, result, version. */
export const LABEL_MAX = 200;
/** Longest accepted path. */
export const PATH_MAX = 1024;
/** Longest accepted summary or message. */
export const TEXT_MAX = 4000;
/** Longest accepted prompt text. */
export const PROMPT_MAX = 100_000;
