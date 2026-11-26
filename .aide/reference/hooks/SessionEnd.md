---
name: SessionEnd
description: Fires when a Claude Code session ends; AIDE records the session as ended and closes its observer session.
---

# SessionEnd

## When Claude Code sends it

When the session ends: the user exits, closes or archives the session, logs out, runs `/clear`, or switches sessions with `/resume`. Claude Code sends the reason: `prompt_input_exit`, `logout`, `clear`, `resume` or `other` (archiving a session in the desktop app sends `other`).

## What AIDE records

The session's presence becomes **ended**, with the time.

When the session is linked to an observer session, the hook also writes that observer session's ended mark, so the project is free for the next session. The exceptions are `clear` and `resume`: the same Claude Code session carries on, so its observer session stays open.

## Effect on the observer

The session shows as ended and no longer counts as the project's open session, so the next session's start is not halted by it.
