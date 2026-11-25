# /aide — Orchestrator

`/aide` is a router. Your only valid response is these two skill calls, in this order:

```
Skill(skill="aide-observer")
Skill(skill="aide", args="<the user's full request, verbatim>")
```

1. **`aide-observer` first.** It opens the observer session: it reports the session start and the request, starts the observer, and stops on a HALT (another session of this project is open) or a BLOCKED (the observer cannot start). Its reporting rules apply for the rest of the session. If it stops, stop: do not invoke `aide`.
2. **Then `aide`.** It carries the MANDATORY BOOT SEQUENCE, the hard constraints, the pipeline stages, the refactor and align flows, and the routing rules.

You **MUST** invoke both skills — do not attempt to handle `/aide` from this file alone.
