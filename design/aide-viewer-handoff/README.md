# AIDE Pipeline Viewer — design handoff

A local, read-only dashboard served from `127.0.0.1` that shows every AIDE project and agent session live. One job above all: **from across a desk, see which phase is running, on which module, by which agent, for how long — and whether anything is waiting on you.**

## Fidelity

High fidelity. Colours, type, spacing, states and copy in the canvas are final unless marked as sample content. Sample content (project names other than `aidemd-mcp`, agent names such as `aide-implementor`, task titles, durations) illustrates real data shapes — replace it with live data. The install command `npx @aidemd-mcp/server init` is an assumption: confirm the real command before shipping.

## What's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file |
| `design_reference/Viewer.dc.html` | The whole viewer as one prototype component: every screen and state, driven by props |
| `design_reference/Prototype.dc.html` | Clickable wrapper with a state picker (controls are not part of the product) |
| `design_reference/Components.dc.html` | Component sheet, dark and light |
| `design_reference/Tokens.dc.html` | Token table with measured contrast, both themes |
| `design_reference/viewer.css` | The single stylesheet — tokens, layout, components, icon masks |
| `design_reference/contrast.json` | Every text × surface ratio, computed from the hex values |

On the canvas: page **Prototype** (play it), **Home screens**, **Session screens**, **Edge states** (each state as dark 1440×900, light 1440×900, dark 375×812, light 375×812) and **Components & tokens**.

## Screens / routes

| Route | Screen | Notes |
|---|---|---|
| `/` | Home — all projects | Waiting-on-you cards → live sessions → projects (expand to sessions) |
| `/p/:project/s/:session` | Session view | The link the agent hands out. Header, banners, now card, phase rail, tabs, history, drawer |
| `/p/:project/s/:session?tab=tree\|plans\|board\|record\|sessions` | Tabs | Tab is in the URL so links can deep-link |
| `…&item=module:src/tools/score` | Detail drawer | Also `task:<slug>`, `file:<path>`, `event:<id>` |
| any route, bad or expired token | Link no longer valid | Calm notice; no live indicators, no stale data |

## Layout

**Session view, desktop (≥ 761px):** header → waiting banner (only when waiting) → reconnecting banner (only when reconnecting) → *Now* section (now card, then phase rail with side lanes) → two columns: tabbed main area (`flex: 999 1 640px`) and History (`flex: 1 1 400px; max-width: 460px`). The drawer overlays the right side (540px) so the now card and rail stay visible.

**Phone (≤ 760px):** single column. The rail scrolls sideways *inside itself* (`.av-rail-scroll`); nothing else scrolls sideways at 375px. History becomes a tab. Board columns stack. Tables become stacked rows. Record outline becomes a horizontal jump strip. Drawer is full-screen. Touch targets ≥ 44px.

## Components (build each as its own React component)

| Component | Class | Props / states |
|---|---|---|
| ConnectionPill | `.av-conn` | `live` (pulsing dot) · `idle` (hollow dot) · `recon` · word always shown |
| WaitBanner | `.av-wait-banner` | gate, file, module, since. Session view only, above everything |
| WaitCard | `.av-wait-card` | Home version; project, gate, file, module, since |
| QuietBanner | `.av-quiet-banner` | Reconnecting. Neutral, not an error |
| NowCard | `.av-card` | `run` · `wait` · `fix` · `idle` · `empty`. Phase 40px, elapsed 40px mono, optional step bar |
| StepBar | `.av-steps` | `n` steps; done / running / not started segments |
| PhaseRail | `.av-rail` + `.av-ph` | 9 phases, each `todo` · `run` · `wait` · `done` · `fail`; optional loop badge ("round 2") |
| SideLanes | `.av-lane` | Structure, Align, Refactor, Cleanup; same states |
| Tabs | `.av-tabs` | role=tablist; counts; History tab phone-only |
| TreeNode | `.av-node` | depth 0–4, collapsed, `cur` (working now), `mis` (misaligned), chips |
| AlignmentBadge | `.av-badge` | Aligned (✓ done) · Unreviewed (dashed ○ outline) · Misaligned (✕ solid red) |
| FileChip | `.av-chip` | brief · research · plan {proposed, approved, completed, abandoned} + a/b · todo {n open of m} |
| PlansTable | `.av-table` | module, kind, status badge, progress bar + text |
| BoardColumn / TaskCard | `.av-col` / `.av-task` | priority p0–p3, type, `linked` = this session. Done shows 5 most recent + "Show all" |
| RecordView | `.av-rec` | outline (jump links) + pinned "Where this cycle stopped" + sections; empty section = `.av-empty` |
| HistoryRow | `.av-hrow` | kinds below; `sub` rows for grouped file writes |
| SessionRow | `.av-srow` | live / idle / ended; Delete only on ended → inline `.av-confirm` |
| ProjectRow | `.av-proj` | name, root, kanban tag, live count, waiting badge, last activity; expands |
| Drawer | `.av-drawer` | module · todo · task · file · prompt · commit · phase · QA verdict · error · session start |
| Notice | `.av-notice` | default · `calm` (dashed; unavailable / empty) · `err` (board can't load) |

History row kinds and glyphs: session started (power) · prompt (speech) · task picked/moved (card) · phase started (flag) · phase finished (✓ + duration) · waiting on you (hand, amber fill) · approved (lock) · plan step checked (✓ box, n/total) · QA verdict (triangle "n issues" / ✓ passed) · files written (stack, grouped under the phase with one `sub` row per path, created/updated) · commit (node + sha) · release (tag + version) · error (! circle, red tint).

## Interactions & behaviour

- **Live updates** stream in; no refresh. New history rows insert at the top (newest-first is default; user can switch to oldest-first).
- **Waiting on you** wins every time: amber fill banner on the session page, amber now card, amber rail phase, amber history row, amber card at the top of Home, and `Waiting on you` badge on the project row. Update `document.title` to start with "Waiting on you —" while any gate is open.
- **Reconnecting** keeps all data on screen, shows the quiet banner and the pill "Reconnecting", and replays missed events on reconnect. Never blank the page.
- **Two live sessions** in one project: header switcher (start time + current phase/module), history session filter (Both / 14:02 / 15:30) and a session tag on each row.
- **Tree:** chevron toggles a branch (collapsed shows "n modules hidden"); Expand all / Collapse all; filter by path; "Only open work" (open todo, or plan proposed/approved); "Only misaligned". Filtering flattens the tree and shows full paths. Count line always says what's hidden.
- **Board:** Done shows the 5 most recent by default with "Show all n". If the brain folder can't be read, only the board area shows the error with the reason and retry timing.
- **Folder never reported:** tree, plans and board each show a calm "unavailable" notice saying why; rail, card, history and sessions work from events.
- **Delete** (the only write): ended sessions only → inline confirmation "Delete this session's history? This can't be undone." → Cancel / Delete history. Live and idle sessions have no Delete.
- **Drawer** opens from tree nodes, plan/todo rows, board cards and history rows; Esc and the close button dismiss it; focus moves into it on open and back on close.
- **Theme toggle** in every header; first load follows `prefers-color-scheme`; choice persisted locally.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no pulse on the live dot, no breathing glow on waiting, no spinning reconnect icon.

## Design tokens

Full table with measured ratios: Tokens artboard / `design_reference/contrast.json`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0D1117` | `#F4F6F9` | Page |
| `--surface` | `#151A22` | `#FFFFFF` | Panels, header, history |
| `--raised` | `#1D2430` | `#EBEFF4` | Hover, table heads, chips |
| `--border` | `#2A323D` | `#D6DCE3` | Decorative dividers only |
| `--border-strong` | `#6E7A8A` | `#76838F` | Control outlines, "not started" dashes (≥ 3:1) |
| `--text` | `#ECF0F5` | `#111821` | Primary |
| `--text-2` | `#BCC5D0` | `#3A4553` | Secondary |
| `--text-3` | `#9DA8B5` | `#525E6D` | Meta (still ≥ 5.7:1) |
| `--run` / `--run-soft` | `#7DB8FF` / `#12263F` | `#0A5BC4` / `#E3EEFD` | Running, links, focus |
| `--done` / `--done-soft` | `#5FD394` / `#0F2A1D` | `#11713A` / `#E2F4E9` | Done, aligned, passed |
| `--danger` / `--danger-soft` | `#FF8B82` / `#341618` | `#B42318` / `#FDE7E5` | Issues, misaligned, errors, delete |
| `--warn` / `--wait-soft` | `#FFC266` / `#33250B` | `#8A4A00` / `#FFF1D6` | Amber text on neutral/soft |
| `--wait` | `#FFB547` | `#FFB020` | The waiting fill |
| `--on-wait` / `--on-wait-2` | `#1A1206` / `#3D2A05` | same | Text on the waiting fill (≥ 7.5:1) |

Lowest measured text ratio: **6.46:1** (dark, `text-3` on `raised`) and **5.28:1** (light, `done` on `raised`).

Type: Inter for UI and prose; JetBrains Mono only for paths, slugs, hashes, durations, versions and code. Sizes 40 / 32 / 24 / 20 / 18 / 16 / **14 (body floor)** / 13 (meta) / **12 (label floor)**. Line-height 1.5 (1.6 in record and drawer prose). Spacing 4 · 8 · 12 · 16 · 24 · 32 · 48. Radius 6 · 10 · 14.

## Assets

No images. Icons are 24×24, 2px-stroke SVGs embedded as CSS masks in `viewer.css` (`.ic.i-<name>`), coloured with `currentColor`. In React, swap for an icon component with the same names: run, wait, done, check, fail, issues, todo, chev-r, chev-d, sun, moon, trash, file, files, commit, prompt, task, flag, gate, error, tag, power, reconnect, unlink, folder, folder-off, search, close, clock, loop, step, move, cloud-off, pin, list, tree, board, doc, history, sessions, idle, eye. Fonts: Inter and JetBrains Mono — self-host them (the page runs offline on 127.0.0.1).

## Acceptance criteria

- [ ] From 2 m away on a 1440×900 screen, the current phase, module, agent and elapsed time are readable without leaning in (phase and elapsed at 40px).
- [ ] Whenever a gate is open, the amber waiting treatment is the most prominent element on Home and on the session page, and the tab title says so.
- [ ] No text below 12px; body and list text ≥ 14px; running text line-height ≥ 1.5.
- [ ] Every text colour on every surface it sits on is ≥ 4.5:1 in both themes (see Tokens). Control outlines ≥ 3:1.
- [ ] Every state shows a glyph or a word as well as colour (rail, lanes, badges, chips, history, connection pill).
- [ ] Mono font appears only on paths, slugs, hashes, durations, versions and code.
- [ ] At 375px wide, nothing scrolls sideways except the phase rail, the tab strip and the record outline strip, each inside itself.
- [ ] Rail shows "Build — step 4 of 9" and "QA → Fix, round 2" without extra rows or overlapping labels.
- [ ] Tree with 44+ modules stays usable: collapse, filter, "only open work", "only misaligned", with a count of what's hidden.
- [ ] Board Done column with 100+ tasks shows 5 recent and "Show all"; board failure shows only in the board area, with the reason.
- [ ] Reconnecting keeps every item on screen and never shows an error page.
- [ ] Invalid link shows no live pill, no rail, no data.
- [ ] Delete exists only on ended sessions and always asks first with the exact confirmation copy.
- [ ] Both themes are complete; `prefers-reduced-motion` removes all pulsing, breathing and spinning.
- [ ] Each component in the table above exists as a self-contained React component with the listed props.

## What NOT to do

- Don't add any control that changes the pipeline or a project: no Approve, Reject, Move task, Start/Stop phase, Retry, Edit file. The waiting state tells the developer to answer in the agent's session.
- Don't add login, accounts, team or remote access.
- Don't show data the server doesn't have: no client name (e.g. "claude-code"), no "skipped" phase state, no file line counts.
- Don't set prose or labels in monospace, and don't use grey text lighter than `--text-3`.
- Don't signal state with colour alone, or with red/green hue alone — every state has a distinct glyph and a word.
- Don't make errors loud outside their own area: board failure stays in the board; reconnecting is a quiet banner.
- Don't blink or pulse when reduced motion is on; don't use emoji as icons.
- Don't let the waiting treatment be outshouted — no other element uses the amber fill.
- Don't let anything except the rail, tab strip and outline strip scroll sideways on a phone.
