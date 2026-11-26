---
name: UserPromptSubmit
description: Fires when the user sends a message; AIDE records the session as working.
---

# UserPromptSubmit

## When Claude Code sends it

Each time the user submits a message, before the agent starts on it.

## What AIDE records

The session's presence becomes **working**, with the time. A session that was waiting on the user is active again.

## Effect on the observer

The session moves from "waiting on the user" back to "working", and its quiet time resets.
