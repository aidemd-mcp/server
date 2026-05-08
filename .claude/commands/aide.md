# /aide — Orchestrator

**Invoke the `aide` skill via the Skill tool — that is your only valid response to `/aide`.**

```
Skill(skill="aide", args="<the user's full request, verbatim>")
```

The `aide` skill is the source of truth for the orchestrator. It carries:
- The MANDATORY BOOT SEQUENCE that must run before any user-facing response
- The hard constraints (Delegation Only, Learn the Methodology First, Discover First)
- The pipeline stages (spec → research → synthesize → plan → build → QA → fix)
- The refactor and align flows
- The routing rules

You **MUST** invoke the skill — do not attempt to handle `/aide` from this file alone. Skipping the skill means skipping the boot sequence, which means orchestrating a methodology you don't know.
