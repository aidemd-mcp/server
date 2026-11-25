import { isValidElement, type ReactElement, type ReactNode } from "react";

/** The props of an element a test can read or call (`onClick`, `aria-label`, `className`, `children`). */
export type ElementProps = Record<string, unknown> & { children?: ReactNode };

/**
 * Every element in a rendered tree (the result of calling a component as a function) for which `match`
 * says yes, in document order. It walks `children` only and never expands a nested component, so a
 * test can find a button and call its `onClick` without a DOM.
 */
export default function findElements({ node, match }: { node: ReactNode; match(element: ReactElement<ElementProps>): boolean }): ReactElement<ElementProps>[] {
	if (Array.isArray(node)) return node.flatMap((child) => findElements({ node: child as ReactNode, match }));
	if (!isValidElement<ElementProps>(node)) return [];
	const found = match(node) ? [node] : [];
	return [...found, ...findElements({ node: node.props.children, match })];
}
