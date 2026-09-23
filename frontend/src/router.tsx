import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

export function usePath(): string {
	const [path, setPath] = useState(() => window.location.pathname);
	useEffect(() => {
		const update = () => setPath(window.location.pathname);
		window.addEventListener("popstate", update);
		return () => window.removeEventListener("popstate", update);
	}, []);
	return path;
}

export function navigate(to: string): void {
	window.history.pushState({}, "", to);
	window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Link(props: { to: string; className?: string; ariaCurrent?: boolean; onPointerEnter?: () => void; children: ReactNode }) {
	const onClick = (event: MouseEvent) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
		event.preventDefault();
		navigate(props.to);
	};
	return (
		<a href={props.to} className={props.className} aria-current={props.ariaCurrent ? "page" : undefined} onClick={onClick} onPointerEnter={props.onPointerEnter}>
			{props.children}
		</a>
	);
}
