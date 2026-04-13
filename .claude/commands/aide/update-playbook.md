# /aide:update-playbook — Playbook Maintenance

> **Agent:** You are the orchestrator for this command. Do NOT delegate to a subagent.

Help the user add new conventions, modify existing ones, or reorganize sections in their coding playbook. Every invocation ends with a required drift-detection step that keeps the playbook hub's task routing table in sync with the actual section structure.

## Checklist

- [ ] Ask the user what they want to change — new convention, modification to an existing one, section rename, section removal, or a general audit with no specific change
- [ ] Use the `study-playbook` skill to read the hub and identify the relevant section (or confirm no section yet exists for the new convention)
- [ ] Make the requested change: add the new content, edit the existing section, rename or remove the section as directed
- [ ] If a section was added, renamed, or removed, offer to reorganize adjacent sections under a new or updated domain grouping if it would improve navigability
- [ ] **Housekeeping step (required — do not skip):** Compare the playbook hub's task routing table against the actual sections that now exist:
  - For each row in the routing table: does the section it points to still exist under that name? Flag stale rows where the target section was renamed or removed
  - For each section now in the playbook: does the routing table have at least one row covering it? Flag new sections with no routing entry
  - Offer to reconcile all drift found — add missing rows, remove or update stale rows, suggest domain regroupings where the table has shifted
- [ ] Apply any routing table changes the user approves
- [ ] Confirm the final state: what was changed in the playbook, what was changed in the routing table
