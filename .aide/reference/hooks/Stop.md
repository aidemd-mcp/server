---
name: Stop
description: Fires when the agent finishes its turn; AIDE records the session as waiting on the user.
---

# Stop

## When Claude Code sends it

When the agent finishes responding and hands control back to the user.

## What AIDE records

The session's presence becomes **waiting**, with the time.

## Effect on the observer

The session shows as "waiting on the user". It is still open: waiting is not ended. A session that stays waiting long enough shows how long it has been quiet, and "maybe stuck" past 15 minutes, but the observer never ends it on its own.
