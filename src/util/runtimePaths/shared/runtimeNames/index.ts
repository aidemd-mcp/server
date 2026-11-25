/** Name of the folder inside a project's runtime folder that holds its event logs. */
export const EVENTS_FOLDER = "events";

/** File extension of a session's event log. */
export const LOG_EXTENSION = ".jsonl";

/** Name of the folder inside a project's runtime folder that holds its archived event logs. */
export const ARCHIVE_FOLDER = "archive";

/** Name of the folder inside a project's runtime folder that holds hook presence records. */
export const PRESENCE_FOLDER = "presence";

/** Name of the folder inside a project's runtime folder that holds ended marks. */
export const ENDED_FOLDER = "ended";

/** File extension of a presence record or an ended mark, each a single JSON object. */
export const RECORD_EXTENSION = ".json";

/** Name of the one observer record at the root of the per-user folder. */
export const OBSERVER_RECORD_FILE = "observer.json";

/**
 * Name of the observer's token file at the root of the per-user folder. Must equal
 * the `TOKEN_FILE` name in `src/observer/loadToken` (util may not import it); the
 * legacy-root move deletes the old copy by this name.
 */
export const OBSERVER_TOKEN_FILE = "observer-token";
