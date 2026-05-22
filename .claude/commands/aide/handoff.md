# /aide:handoff — Session Handoff

**Invoke the `aide-handoff` skill via the Skill tool — that is your only valid response to `/aide:handoff`.**

```
Skill(skill="aide-handoff", args="<the user's full request, verbatim>")
```

The `aide-handoff` skill is the source of truth for the handoff operation. It carries:
- The CREATE vs UPDATE detection logic
- The content-gathering checklist (what the orchestrator must supply in the delegation prompt)
- The delegation contract to the `aide-spec-writer` agent in `session.aide` mode
- The hard constraints (no self-writes, no invented content, no deletion)

You **MUST** invoke the skill — do not attempt to handle `/aide:handoff` from this file alone. Skipping the skill means writing `session.aide` from a thin command-file checklist that omits the load-bearing constraints, which means drifting from the methodology.
