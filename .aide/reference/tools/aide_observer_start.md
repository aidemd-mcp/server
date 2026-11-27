---
name: aide_observer_start
description: Starts the observer, or reuses the running one, and halts the session if another session of the same project is open.
---

# aide_observer_start

The observer is a local web page, one per user per machine, showing every project's sessions live. It is the single source of truth for which session works in a project: a project has at most one open session.

## When to call it

At every session start, after reporting `session_started` with `aide_observer_event` and reading its reply. Call it once more when a report replies `observer not running`.

## Parameters

None.

## What it returns

The first line starts with one of:

| Reply | Meaning |
|---|---|
| `Observer running at <link>` / `Observer already running at <link>` | Go on; give the user the link. |
| `Observer not replaced: …` | An older observer still serves at the link; go on. |
| `REOPENED: …` | This conversation had ended earlier (closed, archived or ended) and nothing newer has worked the project since, so it is open again. The link follows on the next line; go on. |
| `STOPPED: …` | This conversation had ended and cannot reopen: a newer session has worked the project since, or another session ended it with the user's approval. Nothing proceeds and no approval lifts it; the user continues in a new session. |
| `HALT: …` | Another session of this project is open. Each line names it (its observer id, or `claude:<id>` for a Claude session that never reported), whether it is working or waiting on the user, how long it has been quiet (`maybe stuck` past 15 minutes), its last activity, pipeline and phase. Stop and ask the user. |
| `BLOCKED: …` | No port was free (every port tried is named), or this ended conversation could not be reopened (the reason is given). Stop and tell the user. |

## How it decides

- A session is its conversation: a conversation resumed in a fresh process is recognized by its Claude session id, so its own earlier sessions never halt it.
- A session whose transcript ends in its own closing record counts as closed. It never halts a start, and start marks it ended.
- For a conversation that had ended, start checks in this order: ended from another session with the user's approval → `STOPPED`; a newer session has started since → `STOPPED`; another session is open → `HALT`; otherwise → `REOPENED`.

## Ports

It tries `AIDE_OBSERVER_PORT` first when set, then 24680 to 24689 in order, and records the port it took. The link includes its access token.

## Guarantees

- A HALT, STOPPED or BLOCKED is a hard stop: nothing proceeds until the user decides.
- Only the project's most recent session can reopen, so an older conversation never carries on with a stale picture of the project.
- It never ends a session itself.
