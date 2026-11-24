import type { SwitcherOption } from "@/observer/page/types/index.js";

/**
 * The header's switch between two live sessions of one project: each button its start and what it
 * is doing now, the followed one pressed. It only changes which session the card, rail and history
 * follow; the link stays as it is.
 */
export default function SessionSwitcher({ options, onPick }: { options: SwitcherOption[]; onPick(id: string): void }) {
	return (
		<div className="av-switch" role="group" aria-label="Live sessions in this project">
			{options.map((option) => (
				<button key={option.id} type="button" aria-pressed={option.pressed} onClick={() => onPick(option.id)}>
					<span>Session {option.start}</span>
					<span>{option.now}</span>
				</button>
			))}
		</div>
	);
}
