/** Joins the class names that are set, in order, skipping the `false`, `null` and `undefined` a condition leaves behind. */
export default function joinClasses(...names: (string | false | null | undefined)[]): string {
	return names.filter((name): name is string => typeof name === "string" && name !== "").join(" ");
}
