/** The handoff's task note (its task drawer) for the task the pipeline works on. */
const RANK_TASK_NOTE = `# aide_score ranks misaligned specs below unreviewed ones
## Description
aide_score sorts modules by modification time. A misaligned spec edited last week ranks below an unreviewed one edited today, so the next agent starts in the wrong place.
## Acceptance
- Misaligned > unreviewed > aligned
- Ties by open todo count, then path
- Golden test covers the fixture project`;

export default RANK_TASK_NOTE;
