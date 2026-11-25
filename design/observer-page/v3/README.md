# AIDE Pipeline Viewer: changes since your handoff (v3)

You designed the AIDE Pipeline Viewer (your handoff: `Viewer.dc.html`, `Components.dc.html`, `Tokens.dc.html`, `viewer.css`). We built it, used it with real pipeline data, and reworked a lot of the layout and interaction by hand. This package shows **exactly what ships today** (version 0.16.1) so your next handoff can start from it instead of from your original frames.

**Please treat this build as the new baseline.** Keep every change below unless you have a clearly better answer to the same problem. If you do, say which problem it solves better. Your tokens, type scale, colors and `viewer.css` are unchanged. Everything new is in `source/additions.css`, scoped under `.av`.

## What's attached

| Path | What it is |
|---|---|
| `screens/*.png` | Screenshots of every screen and state: 1440×900 desktop, 375×812 phone (2x), and one dark frame. |
| `html/*.html` | The same screens as **self-contained HTML**: the live DOM at capture time with the full stylesheet inlined, fonts included as data URIs, and no scripts. Open them in a browser offline and inspect the exact markup, class names and computed layout. They are static: nothing is clickable. |
| `source/additions.css` | All the CSS we added on top of your `viewer.css`. Every selector starts with `.av`. |
| `source/page.css` | The full built stylesheet: your `viewer.css`, then the additions, then the fonts. |
| `source/page.aide` | The page's intent spec: what the page must and must not do, in our words. |

Screens, in order:

1. `01-home`: Home with two starred projects and one project waiting.
2. `02-home-row-expanded`: a project row expanded, showing the current task card and the mini phase rail.
3. `03-home-waiting-fab-open`: the floating "N waiting" button, open.
4. `04-project-waiting`: the project page with a gate open, the loudest state.
5. `05-project-building`: Build, step 4 of 9.
6. `06-project-qa-fix`: QA → Fix round.
7. `07-tree-expanded`: the intent tree fully expanded.
8. `08-details-module-spec`, `09-details-plan`, `15-details-root-session`: the Details column showing a module's files.
9. `10-drawer-history`, `11-drawer-sessions`, `12-drawer-board`: the bottom drawer.
10. `13-details-task`: a task in Details.
11. `14-details-collapsed`: Details collapsed to a side tab.
12. `16-tree-filters-menu`: the Filters dropdown on a large project.
13. `17-project-waiting-dark`: the waiting state in the dark theme.
14. `18-phone-home`, `19-phone-project-waiting`: phone.

The data is fixture data. Project names, task titles and paths are samples, and several projects deliberately share the same sample task text.

## Hard constraints that held

These are unchanged from your brief, plus a few the build added:

- The page is read-only. Its only controls are viewing, the theme, local ordering and starring (kept in the browser), and **archive → restore / delete permanently** for ended sessions.
- No inline `<style>` and no inline scripts: the page's CSP is `style-src 'self'`. Dynamic sizes come only from React `style` props.
- Readability rules from your brief still apply: text of 12px or more, AA contrast, status never shown by color alone, both themes, and reduced motion respected.
- Nothing may be drawn that the data doesn't have. The one addition to the data is the **current task**: the `task` event carries the slug, title, action (picked/moved) and column. The task note itself is free-form markdown. Only its frontmatter (priority, type) and the column folder are structured.

## What changed, screen by screen

### Home

- **No waiting section, no live-sessions list and no board.**
  - Waiting moved to a **floating "N waiting" button** (bottom right) that opens a list. Each entry links to its project.
  - The live list duplicated the project list, so it was removed.
  - A merged kanban board was tried and removed: too tall, and it duplicated tasks across projects. A better Home board is in our backlog, and we'd welcome a design for one that fits the page: one project at a time, capped height, collapsible.
- **The project list is the page.**
  - Two sections: **Starred** (★, saved in the browser) and **All projects**.
  - A segmented control switches between **Activity** order (waiting, then running, then newest event) and **Custom** order (drag by a grip, with a drop onto the other section toggling the star).
  - A filter input.
  - The order is remembered across reloads and re-sorts calmly. It changes at most every 2 seconds, rows glide (FLIP), and nothing animates on first load.
- **Each project row is one slim line:**
  - star
  - chevron
  - name with a live-count badge, plus the current task title underneath
  - a status badge (`Waiting on you` / `Build · step 4 of 9` / `Fix` / `No phase running`) with the elapsed time
  - last activity
  - a separate **Open project** button
  - No root path and no kanban tag.
  - The whole row is the expand toggle, and its hover highlight spans the full row.
- **An expanded row shows:**
  - a **current task card** (bordered): a `CURRENT TASK` caption with an `Open in project →` link beside it, the title, and chips for column, priority and type
  - below the card, the task note's `##` sections, each collapsible with a one-line preview (progressive disclosure)
  - a **mini phase rail**

### Project page (`/p/<project>/s/<session>`)

The desktop page is now a **fixed frame** at 100vh. The page itself never scrolls; only regions do.

1. **Header:**
   - a **Projects** button (logo plus a back chevron)
   - the project name
   - the session switcher, only when two or more sessions are live
   - the connection pill
   - the theme toggle
   - No breadcrumb and no root path.
2. **One 64px status row, always the same height:**
   - **Waiting on you:** the amber full-width banner with the hand glyph, `Waiting on you`, `approve plan.aide for src/tools/score`, a `since` chip and an **Open plan.aide** button that opens the file in Details. Your separate red "waiting" card and the hint line were removed because they were redundant and made the row jump.
   - **Otherwise:** a quieter **run bar** showing the state word, phase and step, agent, module, the step text, a segmented step bar and the elapsed time. It uses the fix tone during QA → Fix.
   - On phone the banner keeps a one-line hint under it.
3. **Main row:**
   - **Left: the intent tree**, the only content in the main column. All the old content tabs (Tree / Plans & todos / Board / Session record / History / Sessions) are gone on desktop; phone keeps tabs.
     - A sticky toolbar with: search, a **Filters** dropdown (only open work, only misaligned, has plan, has todo, Clear), one **Expand all / Collapse all** toggle, and a count line.
     - The tree **starts fully collapsed**. The top node is labelled **root**.
     - Clicking a row **only expands or collapses it**.
     - **Each `.aide` file is a chip named by its file:** `.aide` / `intent.aide` first, then `session.aide` (root only), `brief.aide`, `plan.aide · <status> <n/m>`, `research.aide` and `todo.aide <n open of m>`. Only clicking a chip opens something in Details.
   - **Right: the Details column**, full height of the main row.
     - Its header shows a kind icon and word (MODULE / FILE / TASK / EVENT) and **Hide ›**. Details cannot be closed. Hidden, it collapses to a narrow vertical **Details** tab; it re-opens when you pick something.
     - A **title block** starts the body: a caption (`Module path` / `File path` / `Task title` / `Title`), the title (never truncated), then the alignment, or the meta (mono) and **chips** (column, priority, type for a task).
     - **A module shows all of its `.aide` files as a full-width accordion.** Each row is the file name with its status or progress on the right. Opened, a row shows every frontmatter field (nested keys flattened, e.g. `outcomes.desired`) and every `##` section in full: the plan's Project Structure code tree, Prerequisites, Plan checklist and Decisions; a todo's issues and Retro. The accordion headers are sticky.
     - When a module is open, root also shows `session.aide`. The old "Session record" tab is gone.
     - A **"More below"** pill and a bottom fade appear when there is more to scroll.
     - Empty state: "Click a module, plan, task or history event to read it here."
   - **Bottom drawer**, the width of the left column only and never covering Details. Its launcher bar is always visible and holds:
     - **History** (count), **Sessions** (count) and **Board** (count) tabs
     - the latest event
     - **Hide**
     - Each opens a panel that scrolls inside itself:
       - **History** has its own sticky head with a **session picker** (it changes only History, the rail and the status row; it never reloads the page) and a **Newest first ↓ / Oldest first ↑** toggle. The type filter buttons are gone. Clicking an event opens it in Details.
       - **Sessions** shows project info (folder and kanban tag, each with Copy) and the session list. Ended sessions are archived first; archived ones can be **restored** or **deleted permanently** (with a confirmation).
       - **Board** has five columns that scroll sideways rather than shrinking; tasks linked to this session are outlined, and clicking a task opens it in Details.
4. **Phase rail:** moved out of the content into a **fixed 52px footer** across the bottom of the page. The "now running" card is hidden on desktop because the status row and footer carry it.

### Phone

The phone layout is largely as you designed it: tabs, a full-screen detail view, and the banner with its hint line. The phone gets Plans, Board, Sessions and History tabs, which desktop no longer has.

### Small details we settled

- The kind word is **Task**, never "Kanban task".
- The empty note reads "This note has no details beyond its title."
- Theme scrollbars are thin and tinted, and hidden on tab strips and the rail.
- Every per-viewer preference lives in localStorage under `aide-viewer:*`: details collapsed, project order mode, custom order, activity order and starred projects.

## What we'd like from you

1. A **refreshed handoff** (`Viewer.dc.html`, `Components.dc.html`, tokens) that matches this build. Redraw our hand-made parts so they use your system properly: the run bar, bottom drawer, Details title block and accordion, file chips, Filters menu, project rows, current task card, FAB, and the collapsed Details tab.
2. **Polish where we improvised.** The spacing and rhythm in `additions.css` were tuned by eye, not to your scale. Flag anything that breaks your system.
3. **A Home board** (optional, backlog): a kanban view on Home that fits the page. Show one project at a time, give it a capped height, make it collapsible, and don't duplicate tasks.
4. Keep the frames for the states in your original brief (not installed, no events, reconnecting, link no longer valid, board can't load, large project). They still apply. Only the layout around them changed.
