/** The bypass-blocks link every screen starts with: off-screen until keyboard focus, then jumps to the element whose id is `target`. */
export default function SkipLink({ target }: { target: string }) {
	return (
		<a className="av-skip" href={`#${target}`}>
			Skip to main content
		</a>
	);
}
