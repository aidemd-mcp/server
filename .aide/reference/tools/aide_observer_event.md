---
name: aide_observer_event
description: Reports one action of the session to the observer, recorded first in the session's own log outside the project and then shown live.
---

# aide_observer_event

How a session tells the observer what it is doing. The server stamps the time, session and order; the agent sends only the kind and its fields.

## When to call it

As each action happens: the session start, every user message, task changes, pipeline phases, approval gates, plan steps, QA verdicts, files written, commits and errors.

## Parameters

`kind`, plus that kind's fields:

| Kind | Fields |
|---|---|
| `session_started` | `projectRoot`, `kanbanTag`. First, once per session, and on its own. |
| `prompt` | `text`: the user's message in full. |
| `task` | `slug`, `action` (`picked` or `moved`), `title?`, `column?` |
| `pipeline_started` | `pipeline`, `phase` it starts or resumes at |
| `pipeline_finished` | `pipeline`, `result` (`completed` or `abandoned`) |
| `phase_skipped` | `pipeline`, `phase`, `reason` |
| `phase_started` | `pipeline`, `phase`, `agent`, `module` |
| `phase_finished` | `pipeline`, `phase`, `agent`, `module`, `result?`, `summary?` |
| `gate_waiting` | `pipeline`, `gate`, `file` awaiting the user's approval |
| `gate_resolved` | `pipeline`, `gate`, `file`, `resolution?` |
| `plan_step_checked` | `pipeline`, `module`, `step`, `total?` |
| `qa_verdict` | `pipeline`, `module`, `verdict` (`passed` or `issues`), `open?` |
| `file_written` | `path`, `action` (`created` or `updated`) |
| `commit` | `sha`, `message?` |
| `release` | `version` |
| `error` | `message`, `agent?`, `module?` |

A pipeline is one feature flow, named by its kanban task's slug. Phases are spec, research, synthesize, structure, plan, build, qa, fix, align, refactor and cleanup.

## What it returns

One line ending with `[observer-session <id>]`, this session's id:

| Reply | Meaning |
|---|---|
| `recorded` | Written to the log and shown live. |
| `recorded; observer not running` | Written to the log only. Call `aide_observer_start` once. |
| `refused: session ended` | Another session ended this one with the user's approval. Stop and tell the user. |

## Guarantees

- A report never fails or stalls the session: never retry one and never wait on one.
- The log lives in per-user storage outside the project.
