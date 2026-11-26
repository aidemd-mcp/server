---
name: aide-observer
description: >
  Opens and keeps the observer session for an AIDE session: reports the
  session start and the user's request, starts the observer (one per user
  per machine), stops on a HALT when another session of the project is
  open or a BLOCKED when the observer cannot start, gives the user the
  link, and reports every pipeline action as it happens — pipelines,
  phases, skips, gates, plan steps, QA verdicts, files, commits. The
  observer is mandatory: it is the single source of truth for which
  session works in a project. Run this skill FIRST in every /aide
  session, before the `aide` skill, including when `aide` is invoked
  directly, unless the user said not to observe this session. Its
  reporting rules apply for the rest of the session.
---

# aide-observer — the observer session

The observer is a local web page, one per user per machine, that shows every project's agent sessions live. It is the single source of truth for which session is working in a project, so it is not optional: a project has at most one open session at a time, and the session start is where that is checked.

This skill owns everything the agent does with the observer. The `aide` skill keeps no observer text; it relies on the rules below.

## Session start

Run these in order, one call at a time, before the `aide` skill's boot:

1. **Check the tools.** If `aide_observer_event` and `aide_observer_start` are not available, tell the user once that the observer tools are missing (the aide server is not loaded) and stop: nothing proceeds unobserved.
2. **Report the session start, alone.** Call `aide_observer_event` with `kind: "session_started"` and what you know: `projectRoot` (the project's absolute path) and `kanbanTag` (the `Kanban project tag:` line of the instructions file). Leave out anything you don't know. Do not report a brain folder: the observer finds the board from the `kanban` field of the project's own brain config. **Make this call on its own and read its reply before anything else** — never batch it with another call. The reply ends with `[observer-session <id>]`; that is this session's observer id, and the hook links your Claude session to it while the reply comes back.
3. **Report the user's request.** Call `aide_observer_event` with `kind: "prompt"` and the user's message in full.
4. **Start the observer.** Call `aide_observer_start` (no arguments). Its reply starts with one of:
   - `Observer running at <link>` or `Observer already running at <link>` — keep the link and go on.
   - `Observer not replaced: …` — an older observer is still serving; keep the link it names and go on.
   - `HALT: …` — another session of this project is open. **Hard stop.** See "HALT" below.
   - `BLOCKED: …` — the observer could not start on any port. **Hard stop.** Tell the user the reason as given (it names every port tried) and stop. Nothing proceeds until the user fixes it and starts a new session.
5. **Give the user the link** once the `aide` skill's boot sequence is complete, in one line.

## HALT

A HALT reply names each open session of the project: its observer id (or `claude:<id>` for a Claude session that never reported), whether it is working or waiting on the user, how long it has been quiet ("maybe stuck" past 15 minutes), its last activity, and its pipeline and phase.

A HALT is the observer's view, not proof that the session is still running: a session closed while its end hook was cut short stays "open" forever. Check each one before you tell the user anything about it.

1. Stop all other work. Do not run the `aide` skill's boot or touch any file.
2. **Find each session's Claude session id.** A `claude:<id>` line already names it. For an observer id, read the project's presence records: the `*.json` files in the `presence` folder of the project's runtime folder, whose name is the `p/<key>` part of the observer link (under `$AIDEMD_HOME` when it is set, else `~/.aidemd` on Windows, `~/Library/Application Support/aidemd` on macOS, `$XDG_STATE_HOME/aidemd` or `~/.local/state/aidemd` elsewhere). The record whose `sessionId` is the observer id gives `claudeSessionId`, its last hook (`hookEvent`, `at`) and its `transcriptPath`. Only read these files; never edit or delete them.
3. **Check whether that Claude session is really running,** with whatever the host gives you. In the Claude desktop app, list the sessions including archived ones and find the one in this project's folder whose last activity matches the presence `at`: `isRunning` and `isArchived` give its real state. In a terminal, look for a running `claude` process for this project and at when the transcript was last written. If nothing you can reach answers it, say you could not verify it, and never claim it is running.
4. Tell the user, in plain words, which session holds the project, what it was doing, its Claude session id, and what the check found: still running (and where), closed without reporting its end, or not verifiable.
5. Ask the user what to do: end that session, or close this one. Never decide for them, and never end a session because it looks quiet. A session the check found closed is safe to end; say so.
6. Only on the user's clear yes, call `aide_observer_end_session` with the id the HALT named: an observer id as written, or, for a `claude:<id>` line, the id without the `claude:` prefix. Ending only marks the session ended; it deletes nothing. It refuses your own session.
7. If it replies `not ended (<reason>)`, the mark could not be written: tell the user the reason, the HALT still stands, and try again only if the user says so.
8. After `ended` or `already ended`, call `aide_observer_start` again and handle its reply as in step 4 of the session start. A second HALT names whatever is still open.

If the user chooses to close this session, stop and say so.

## Reporting

Report each action through `aide_observer_event` as it happens. Every reply ends with `[observer-session <id>]`.

| When | Report |
|---|---|
| The user sends a message | `prompt` with the message in full |
| The session takes up a task — at boot or later, including one already In Progress that nothing moves | `task` with its slug, `picked`, and the column it is in |
| A task is moved on the board | `task` with its slug, `moved`, and the column it moved to |
| A feature pipeline starts or resumes | `pipeline_started` with the pipeline and the phase it starts at |
| A phase is passed over — the flow starts later than spec ("just plan it"), research or synthesize is skipped by routing, QA passes with no fix loop, or any other stage is not run | `phase_skipped` with the pipeline, the phase and a short reason |
| Before you delegate to a pipeline agent | `phase_started` with the pipeline, the phase, the agent's name and the module |
| When it returns — including on failure or when you abandon it | `phase_finished` with the same pipeline, phase, agent and module, a short result and summary |
| You pause for the user's approval of a file (structure tree, spec, plan) | `gate_waiting` with the pipeline, the gate and the path of the file awaiting approval |
| The user answers | `gate_resolved` with the same pipeline, gate and file, and the resolution |
| An implementor checks off a plan step | `plan_step_checked` with the pipeline, the module, the step and the plan's step count |
| QA returns | `qa_verdict` with the pipeline, the module, `passed` or `issues`, and the open count |
| The pipeline is done (cleanup finished) or the user abandons it | `pipeline_finished` with the pipeline and `completed` or `abandoned` |
| You write or edit a file yourself (session record, prose) | `file_written` with its path, `created` or `updated` |
| A commit or release lands | `commit` with the sha and message, or `release` with the version |
| Something fails | `error` with the message, and the agent and module when known |

**Pipelines.** A pipeline is one feature flow run by the `/aide` orchestrator, from the stage it starts at to completion or abandonment, across every module it plans. Name it by its kanban task's slug; with no task, give it a short name and keep it for the whole flow. A later session that resumes the same task continues the same pipeline: report `pipeline_started` with the same name and the phase it resumes at — stages finished in earlier sessions show as done on their own. Every phase, gate, plan-step and QA report names its pipeline. Work you do by hand outside a pipeline (prose edits, a quick fix) names none: report its `file_written` and `commit` events only.

**Phases:** spec, research, synthesize, structure, plan, build, qa, fix, align, refactor, cleanup. Pair every `phase_started` with a `phase_finished`. Report spec as a phase, not only as a gate. The module is the folder the phase works on, as a project-relative path.

## When a report misses the observer

A report always lands in the session's own record first; a reply of `recorded; observer not running` means only the live page missed it.

- On the first such reply in a run of misses, call `aide_observer_start` once. If it brings the observer back, carry on; the next report that gets through resets the run.
- If that restart replies `BLOCKED: …`, stop: tell the user the reason and that nothing proceeds unobserved. Do not try again on your own.
- Never retry a report, never wait on one, and never stop because one report missed a running observer.

A reply of `refused: session ended` means another session ended this one with the user's approval. Stop all work and tell the user.

## Not observing a session

If the user says not to observe this session, make no further reporting calls for the rest of it. The session start (steps 1–4 above) still runs, because the one-open-session check protects the project; say so if the user asks to skip it too, and follow their answer.
