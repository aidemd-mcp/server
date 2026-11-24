import Icon from "@/observer/page/shared/Icon/index.js";
import type { IconName, TreeAlignment } from "@/observer/page/types/index.js";

/** Class, glyph and word per alignment: Aligned (check), Unreviewed (dashed circle), Misaligned (solid red cross), so no state rests on colour alone. */
const LOOK: Record<TreeAlignment, { className: string; icon: IconName; word: string }> = {
	aligned: { className: "av-badge done", icon: "done", word: "Aligned" },
	unreviewed: { className: "av-badge outline", icon: "todo", word: "Unreviewed" },
	misaligned: { className: "av-badge strong-danger", icon: "fail", word: "Misaligned" },
};

/** The badge a module's intent spec earns: its alignment as a glyph and a word. */
export default function AlignmentBadge({ alignment }: { alignment: TreeAlignment }) {
	const look = LOOK[alignment];
	return (
		<span className={look.className}>
			<Icon name={look.icon} />
			{look.word}
		</span>
	);
}
