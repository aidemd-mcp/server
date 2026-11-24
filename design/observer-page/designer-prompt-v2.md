Design a **local web dashboard** called the **AIDE Pipeline Viewer**. This is a new, standalone design — it does not inherit any existing site theme. Give it its own clean, modern, highly readable identity.

## What it is

AIDE is a multi-phase engineering pipeline that an AI coding agent (Claude Code) runs inside a software project: spec → research → synthesize → plan → plan approval → build → QA → fix → done. A developer runs several projects and agent sessions at once. The viewer is a page served by one small server on their machine (127.0.0.1) that shows every project and every agent session, live. Developers keep it open on a second monitor and glance at it from across a desk; sometimes they check it on a phone.

It is **read-only**, with one exception: deleting a past (ended) session's history.

## The one job

From across a desk, answer in one glance: **which phase is running, on which module, by which agent, for how long — and is anything waiting on me?** "Waiting on you" (the agent paused for the developer's approval, usually of a plan) must be the loudest thing on every screen it appears on. Everything else is secondary.

Second job: someone returns after hours or a day; the history tells them what happened, in order, and lets them open any item.

## Readability is a hard requirement (the previous design failed here)

- Body and list text ≥ 14px; the smallest labels/meta ≥ 12px; line-height ≥ 1.5 for running text.
- Every text color passes WCAG AA (≥ 4.5:1) on every surface it sits on, in both themes; ≥ 3:1 only for large text and non-text UI. Keep a visible hierarchy without using unreadable greys.
- Don't set everything in a monospace font: use a proportional UI font for labels and prose; use a monospace font only for paths, slugs, commit hashes, durations and code.
- Status must never rely on color alone: pair every state color with a glyph or word.
- Dark and light themes, both first-class. Respect prefers-reduced-motion (no pulses or blinking then).
- Phone: at 375px wide nothing scrolls sideways; long rows (like the phase rail) may scroll inside themselves.

## Screens

### 1. Home — all projects
- Top: anything **waiting on you**, across all projects (project, module, what needs approval e.g. `approve plan.aide`, since when) — loudest element.
- Live sessions across projects (project, current phase/module/agent, elapsed).
- Projects list: name, root path, kanban tag, live session count, last activity. Each expands to its sessions (start time, duration, event count, task it worked on, live/idle/ended). Ended sessions have **Delete** with a confirmation ("Delete this session's history? This can't be undone."). Live sessions have no delete.
- Designs for: 1 project, 10+ projects, nothing recorded yet.

### 2. Session view (the link the agent hands out opens this)
- Header: breadcrumb back to Home (`All projects / aidemd-mcp / session 14:02`), project root path, kanban tag, connection state (live / idle / reconnecting), theme toggle. When two sessions are live in the same project, a session switcher.
- **Phase rail + "now running" card** — the biggest element. Main line: Spec, Research, Synthesize, Plan, Plan approval, Build, QA, Fix, Done. Side lanes: Structure, Align, Refactor, Cleanup. Each phase is one of: not started · running (agent, module, elapsed) · waiting on you · done · found issues/failed. Must show "Build — step 4 of 9" and "QA → Fix, round 2" without clutter. The card examples: **Plan · aide-architect · src/tools/score · 3m 41s**; **Waiting on you — approve plan.aide for src/tools/score · since 2m**; idle: last module and what it finished.
- **Intent tree**: nested spec folders (root `.aide/intent.aide`, then one node per folder with a spec), each with a one-line description, an alignment badge (unreviewed / aligned / misaligned — misaligned stands out), and working-file chips: `brief` present, `plan` with status (proposed / approved / completed / abandoned) and progress (6/9), `todo` with open issues (3 open of 5), `research`. The module being worked on is highlighted. Collapse/expand and filters ("only open work", "only misaligned"); 40+ modules must stay usable.
- **Plans & todos**: flat list of every plan and todo with module, kind, status, progress.
- **Kanban board**: Backlog, Todo, In Progress, In Review, Done. Card: title, slug, priority p0–p3, type (bug, feature, change, housekeeping, test); tasks linked to this session highlighted; Done can hold 100+ (collapsed / recent only). If the board can't load, an inline calm error in the board area only, with the reason.
- **Session record**: a long markdown document (hundreds of lines) with sections: State summary · Kanban · Architectural intent (numbered decisions, numbers can have gaps) · Anti-regression invariants · **Where this cycle stopped** with **What the next agent must do** (numbered list) · Open questions. Pin "Where this cycle stopped"; give it an outline/jump list; an empty section looks calm.
- **History**: chronological rows (time, glyph, short label), filter by type and (with two live sessions) by session. Row kinds: session started · user prompt (first line; full text on open) · task picked/moved · phase started · phase finished (duration) · waiting on you / approved · plan step checked (3/9) · QA verdict (3 issues / passed) · file written (group consecutive file writes under their phase) · commit / release · error.
- **Sessions list** for this project (same rows as Home, with Delete for ended ones).
- **Detail drawer** (side panel; the live view stays visible): a module (spec frontmatter: intent, desired and undesired outcomes; body sections; the plan as a checklist with numbered steps and sub-steps like 2a/2b; the todo as a checklist of `file:line — what's wrong` issues plus a Retro), a kanban task (rendered markdown), a file, or a history item (e.g. the full prompt, the phase summary, the commit message).

## States to design (one frame each)
1. AIDE not installed in this project (calm, says what to run).
2. Installed, no events yet.
3. Live, building (step 4 of 9).
4. Live, **waiting on you** — the loudest frame.
5. Idle (session quiet or ended).
6. Two sessions live in one project.
7. Board can't load (brain unreachable) — everything else works.
8. Large project — 40+ tree nodes, 100+ tasks.
9. QA → Fix round 2, a todo with 2 of 5 open.
10. Home with several projects, one waiting on you.
11. Home with nothing recorded yet.
12. Reconnecting — the server restarted; the page reconnects by itself, nothing lost (a quiet state, not an error screen).
13. A project that never reported its folder — tree and board say why they're unavailable; history and sessions still work.
14. Link no longer valid (bad or expired access link) — a calm notice, no stale "live" indicators.

## Data the page really has (don't draw anything outside this)
Per session event: kind, time, and fields — session started (project root, kanban tag, brain folder) · prompt (full text) · task (slug, title, picked/moved, column) · phase started/finished (phase, agent, module, result, summary) · gate waiting/resolved (gate, file) · plan step checked (module, step, total) · QA verdict (module, passed/issues, open count) · file written (path, created/updated) · commit (sha, message) · release (version) · error (message, agent, module). Per project: the intent tree with each file's status and progress, the session record, the kanban board, session liveness. There is **no** client name (e.g. "claude-code"), no "skipped" phase state, no file line counts.

## Out of scope
Any control that changes the pipeline or a project (approve plan, move task, start phase), file editing, login, remote/team access. No buttons that imply these.

## Build for reuse
Self-contained components (phase rail, running card, tree node, chip/badge, board card, history row, session row, project row, drawer, notices) — they'll be implemented in React and later reused in a chat-first IDE.

## Deliverables (Claude Design handoff)
- A handoff folder: `README.md` (overview, fidelity, screens/routes, interactions and behavior, design tokens, assets, **Acceptance criteria** checklist, and a **What NOT to do** list) and `design_reference/` (the HTML/CSS/JS prototype).
- High-fidelity frames for every state above, dark and light, at 1440×900 and 375×812.
- A component sheet (rail phase states, chips, badges, history row variants, board card, project/session rows, drawer, notices).
- A token table with measured contrast for every text color on every surface, both themes.
- Use realistic content: modules like `src/tools/score`, `src/service/install`, `src/cli/init`; tasks like "aide_validate with a path reports missing specs from the whole project"; commits like `414776f`; durations like `4m 12s`.
