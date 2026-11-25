import { MINUTES_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import buildingProject from "@/observer/seedFixtures/scenarios/shared/buildingProject/index.js";
import homeProject from "@/observer/seedFixtures/scenarios/shared/homeProject/index.js";
import paddedSession from "@/observer/seedFixtures/scenarios/shared/paddedSession/index.js";


const WAITING_MODULE = "src/pages/docs/score";
const WAITING_TASK = { slug: "aide-score-docs-page", title: "Docs page for aide_score" };
const CRAWLER_TASK = { slug: "crawl-delay-robots", title: "Respect crawl-delay from robots.txt" };
const GATE_APPROVE = "Approve plan.aide for src/pages/docs/score (9 steps).";

/**
 * The handoff's `home-several` projects, aged from its Home clock (14:34 on the Monday its sessions are dated
 * from): `aidemd-mcp` holds a live Build, `aidemd-site` waits on a plan approval, `lead-crawler` runs QA,
 * `ledger-api` is idle and `docs-portal` has ended.
 */
export default function home(): FixtureScenario[] {
	return [
		{
			id: "aidemdMcp",
			label: "home aidemd-mcp",
			// The handoff's m1 (Build step 4 of 9, 7m 55s in) and m2 to m4: the project `s-building` reads.
			project: buildingProject({ large: false, brain: "present" }),
		},
		{
			id: "aidemdSite",
			label: "home aidemd-site (waiting)",
			project: homeProject({
				folderName: "aidemd-site",
				tag: "aidemd-site",
				module: WAITING_MODULE,
				waiting: true,
				sessions: [
					paddedSession({
						pid: "live",
						presence: { state: "waiting", minutesAgo: 6 },
						startAgoMin: 24 + 12 / 60,
						events: 31,
						task: WAITING_TASK,
						workEvents: [
							{ offsetMin: 10, kind: "phase_started", pipeline: WAITING_TASK.slug, phase: "plan", agent: "aide-architect", module: WAITING_MODULE },
							{ offsetMin: 6.05, kind: "phase_finished", pipeline: WAITING_TASK.slug, phase: "plan", agent: "aide-architect", module: WAITING_MODULE },
							{ offsetMin: 6.03, kind: "file_written", path: `${WAITING_MODULE}/plan.aide`, action: "created" },
							{ offsetMin: 6, kind: "gate_waiting", pipeline: WAITING_TASK.slug, gate: GATE_APPROVE, file: `${WAITING_MODULE}/plan.aide` },
						],
					}),
				],
			}),
		},
		{
			id: "leadCrawler",
			label: "home lead-crawler",
			project: homeProject({
				folderName: "lead-crawler",
				tag: "crawler",
				module: "src/crawl/robots",
				sessions: [
					paddedSession({
						pid: "live",
						presence: { state: "working", minutesAgo: 1 },
						startAgoMin: 46,
						events: 77,
						task: CRAWLER_TASK,
						workEvents: [
							{ offsetMin: 2 + 3 / 60, kind: "phase_started", pipeline: CRAWLER_TASK.slug, phase: "qa", agent: "aide-qa", module: "src/crawl/robots" },
							{ offsetMin: 1, kind: "file_written", path: "src/crawl/robots/index.ts", action: "updated" },
						],
					}),
					// Mon 10:20, 2h 03m, 260 events: with 14:34 on that Monday it began 4h 14m ago.
					paddedSession({
						pid: "dead",
						startAgoMin: 4 * 60 + 14,
						durationSec: 2 * SECONDS_PER_HOUR + 3 * SECONDS_PER_MINUTE,
						events: 260,
						task: { slug: "retry-budget-per-domain", title: "Retry budget per domain" },
					}),
				],
			}),
		},
		{
			id: "ledgerApi",
			label: "home ledger-api (idle)",
			// The process is still alive but its last event is 3 h old, past the 30-minute idle rule, so it reads Idle.
			project: homeProject({
				folderName: "ledger-api",
				tag: "ledger",
				sessions: [
					paddedSession({
						pid: "live",
						presence: { state: "working", minutesAgo: 3 * 60 },
						startAgoMin: 3 * 60 + 38 + 11 / 60,
						durationSec: 38 * 60 + 11,
						events: 64,
						task: { slug: "idempotency-keys-entries", title: "Idempotency keys on POST /entries" },
					}),
				],
			}),
		},
		{
			id: "docsPortal",
			label: "home docs-portal",
			// Thu 15:30, 51m 00s, 88 events; its last event is 4 days old, the handoff's last activity for the project.
			project: homeProject({
				folderName: "docs-portal",
				tag: "docs",
				sessions: [
					paddedSession({
						pid: "dead",
						startAgoMin: 4 * MINUTES_PER_DAY + 51,
						durationSec: 51 * 60,
						events: 88,
						task: { slug: "sidebar-collapse-phone", title: "Sidebar collapses on phone" },
					}),
				],
			}),
		},
	];
}
