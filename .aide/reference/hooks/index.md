---
name: hooks
description: The five Claude Code hook events AIDE listens to, and what each one tells the observer about a session.
---

# AIDE Claude Code hooks

Claude Code runs hooks itself, apart from the AIDE server, at fixed moments in a session. AIDE listens to five of them through one command that runs this machine's installed AIDE server directly with node (`node "<install>/dist/index.js" hook`), registered in each developer's own uncommitted `.claude/settings.local.json`. Each call records the session's **presence**: whether it is working, waiting on the user or ended, and when. That is how the observer knows which sessions are really alive, even when an agent never reports anything.

Hooks report presence only. What the session is doing (its pipeline, phase and files) comes from the agent's own reports through [aide_observer_event](../tools/aide_observer_event.md).

| Event | Presence it records |
|---|---|
| [SessionStart](./SessionStart.md) | working |
| [UserPromptSubmit](./UserPromptSubmit.md) | working |
| [PostToolUse](./PostToolUse.md) | working, and links the session to its observer session |
| [Stop](./Stop.md) | waiting on the user |
| [SessionEnd](./SessionEnd.md) | ended |

## What every hook call does

1. Reads the event Claude Code sends: the session id, the event name, the project folder and the transcript's location.
2. Records the session's presence (state, time, event and transcript location) in per-user storage outside the project.
3. Pings a running observer so open pages update without a reload.

## Guarantees

- **Silent.** A hook prints nothing. On some events Claude Code would show printed text to the agent, so AIDE never prints.
- **Never fails the agent.** Every call exits successfully, whatever goes wrong: a malformed input, an unwritable disk or an observer that is off.
- **Never blocks.** A hook never asks anything and never stops the agent's work. It gives up on its own work after one second.
- **Never starts the observer**, never ends any session but its own, and never deletes anything.
- **Presence first.** The record is written before the observer is contacted, so it survives the observer being off.

## When a hook never runs

A crash, a force-kill or a cut-off end hook can leave a session's last presence at working or waiting. The observer then checks the session's transcript: when its last record is Claude Code's own closing record for that session, the session counts as closed without reporting its end, and it no longer blocks the next session.
