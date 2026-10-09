/** A required section that is read at runtime from the brain config; it is never written into the brain. */
type LiveSectionEntry = {
	marker: string;
	field: string;
	purpose: string;
	role: "live";
};

/** A required section whose body is written into the brain at setup, at the brain-relative `seedPath`. */
type SeedSectionEntry = {
	marker: string;
	field: string;
	purpose: string;
	role: "seed";
	seedPath: string;
};

/** One required body section of the brain config: live entries carry no `seedPath`, seed entries always do. */
export type BrainSectionContractEntry = LiveSectionEntry | SeedSectionEntry;

/**
 * The one published source of the brain config's required-section contract.
 * The parser enforces it, provisionBrain's repair draws from it, and agents
 * read it through `aide_init`'s brain config step. The array order is the
 * required body order. Adding a required section is one appended entry here
 * plus the matching block in the bundled template; existing entries never
 * reorder.
 */
const brainContract = [
	{
		marker: "orientation",
		field: "orientation",
		purpose:
			"Runtime briefing aide_brain returns when an agent reaches for the brain: which tools reach it and which entry points to start from.",
		role: "live",
	},
	{
		marker: "config",
		field: "config",
		purpose:
			"Backend-specific wiring and seeding flow /aide:brain config runs: fill unwired launcher slots, run sync, then seed the brain.",
		role: "live",
	},
	{
		marker: "playbook-index",
		field: "playbookIndex",
		purpose:
			"Coding-playbook index seeded into the brain; routes each task to the playbook sections that apply.",
		role: "seed",
		seedPath: "coding-playbook/coding-playbook.md",
	},
	{
		marker: "study-playbook",
		field: "studyPlaybook",
		purpose:
			"Playbook navigation guide the study-playbook skill sends agents to before they write or review code.",
		role: "seed",
		seedPath: "coding-playbook/study-playbook.md",
	},
	{
		marker: "update-playbook",
		field: "updatePlaybook",
		purpose:
			"Playbook maintenance guide /aide:update-playbook follows when conventions are added, changed, or removed.",
		role: "seed",
		seedPath: "coding-playbook/update-playbook.md",
	},
	{
		marker: "research-index",
		field: "researchIndex",
		purpose:
			"Research index seeded into the brain; domain research is filed under it by domain.",
		role: "seed",
		seedPath: "research/research.md",
	},
	{
		marker: "kanban-board",
		field: "kanbanBoard",
		purpose:
			"Empty kanban board with its five columns, seeded into the brain for tracking project work.",
		role: "seed",
		seedPath: "kanban/board.md",
	},
	{
		marker: "kanban-index",
		field: "kanbanIndex",
		purpose:
			"Kanban index the kanban skill sends agents to first: the board line and card formats, priorities, project tag and linking, how to reach the board, and a link to each operation's guide.",
		role: "seed",
		seedPath: "kanban/kanban.md",
	},
	{
		marker: "kanban-create",
		field: "kanbanCreate",
		purpose:
			"Kanban guide for creating a card: gather its details, then write the card and add its line to the board.",
		role: "seed",
		seedPath: "kanban/guide/create.md",
	},
	{
		marker: "kanban-work",
		field: "kanbanWork",
		purpose:
			"Kanban guide for working a card: pick it, plan, implement, test and self-review it behind the user's approval gates.",
		role: "seed",
		seedPath: "kanban/guide/work.md",
	},
	{
		marker: "kanban-manage",
		field: "kanbanManage",
		purpose:
			"Kanban guide for viewing the project's cards and moving them between columns.",
		role: "seed",
		seedPath: "kanban/guide/manage.md",
	},
	{
		marker: "kanban-move",
		field: "kanbanMove",
		purpose:
			"Kanban guide for moving the current session's card to a named column.",
		role: "seed",
		seedPath: "kanban/guide/move.md",
	},
	{
		marker: "kanban-complete",
		field: "kanbanComplete",
		purpose:
			"Kanban guide for moving the current session's card to In Review, or to Done.",
		role: "seed",
		seedPath: "kanban/guide/complete.md",
	},
	{
		marker: "kanban-stash",
		field: "kanbanStash",
		purpose:
			"Kanban guide for saving the session's changes, decisions, open questions and remaining work into the current card.",
		role: "seed",
		seedPath: "kanban/guide/stash.md",
	},
	{
		marker: "kanban-review",
		field: "kanbanReview",
		purpose:
			"Kanban guide for reviewing the current card's changes and running the fix cycle when changes are requested.",
		role: "seed",
		seedPath: "kanban/guide/review.md",
	},
] as const satisfies readonly BrainSectionContractEntry[];

export default brainContract;

/** Camel-case field name of a required section, derived from the contract. */
export type BrainSectionField = (typeof brainContract)[number]["field"];

/** Kebab-case marker name of a required section, derived from the contract. */
export type BrainSectionMarker = (typeof brainContract)[number]["marker"];
