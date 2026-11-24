/** The folded-folder set with `folder` flipped: folded if it was open, open if it was folded. The input is left as it was. */
export default function toggleFolder({ collapsed, folder }: { collapsed: ReadonlySet<string>; folder: string }): ReadonlySet<string> {
	const next = new Set(collapsed);
	if (!next.delete(folder)) next.add(folder);
	return next;
}
