# /aide-fix — Fix Phase

Work one unchecked item from the `todo.aide` checklist. This is the implementor phase in fix mode — the same agent that runs `/aide:build`, invoked with a narrower scope and a stricter one-session-per-item protocol.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module
- [ ] Read `todo.aide` and pick the next unchecked item. Do not pick ahead, do not bundle
- [ ] Fix exactly ONE issue. Do not fix adjacent issues discovered during the session — add them to the `todo.aide` checklist instead, unchecked, for future sessions
- [ ] Base the fix on the spec, not on the one-line issue description. The description points at the problem; the spec is the source of truth for what correct looks like
- [ ] Run the generation command (or equivalent) to produce fresh output after the fix
- [ ] Compare the new output against the baseline from before the fix:
  - Is the targeted issue resolved?
  - Did anything else regress? The fix may have moved unrelated output further from the spec
- [ ] Run tests and the type checker to catch structural regressions
- [ ] Check the item off in `todo.aide` only if both the targeted fix landed and no regression was introduced. Otherwise revert, leave the item unchecked, and end the session
- [ ] Commit the fix in its own commit — one checkbox, one commit, one diff
- [ ] End the session. The next item starts in a fresh session with clean context — do not continue working additional items in the same session
