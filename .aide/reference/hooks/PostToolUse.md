---
name: PostToolUse
description: Fires after every tool call; AIDE records the session as working and links it to its observer session.
---

# PostToolUse

## When Claude Code sends it

After every tool call the agent makes, whatever the tool.

## What AIDE records

The session's presence becomes **working**, with the time, so a long stretch of agent work keeps the session live.

## Linking the session to its observer session

When the tool was `aide_observer_event`, its reply ends with `[observer-session <id>]`. The hook reads that id and records it with the presence. From then on the observer knows which Claude Code session is behind that observer session, so it can tell whether the session is still alive and end it when Claude Code reports the end.

## Effect on the observer

The session stays "working" while the agent uses tools, and its quiet time resets with each call.
