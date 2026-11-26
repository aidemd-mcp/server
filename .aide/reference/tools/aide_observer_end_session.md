---
name: aide_observer_end_session
description: Ends another open session of the project after the user approves, so a HALT can be cleared.
---

# aide_observer_end_session

Clears the way when `aide_observer_start` halts on another session of the project.

## When to call it

Only after a HALT, and only when the user has chosen to end the session it names.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `sessionId` | Yes | The id exactly as the HALT gave it: an observer session id, or for a `claude:<id>` line the id without the `claude:` prefix. |

## What it returns

One line:

| Reply | Meaning |
|---|---|
| `ended <id>` | Marked ended. Call `aide_observer_start` again. |
| `already ended <id>` | It was already ended. Call `aide_observer_start` again. |
| `refused: <id> is this session` | It never ends the caller's own session. |
| `refused: no session <id> in this project` | No such session here. |
| `refused: invalid session id` | The id is malformed. |
| `not ended (<reason>)` | The mark could not be written. |

## Guarantees

- Ending only writes a mark: no log, presence record or project file is deleted.
- The ended session's later reports are refused.
