---
name: SessionStart
description: Fires when a Claude Code session starts or resumes; AIDE records the session as working.
---

# SessionStart

## When Claude Code sends it

When a session starts, including a resumed session and a fresh start after `/clear`.

## What AIDE records

The session's presence becomes **working**, with the time. This is often the first sign of the session the observer sees, before the agent reports anything.

## Effect on the observer

The session appears as live in its project. If the agent then runs `/aide`, the session start check counts this session as the project's open one.
