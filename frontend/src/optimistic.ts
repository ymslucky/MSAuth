/**
 * Optimistic mutations — ONE engine for every delete/revoke/rename flow: the
 * UI change lands immediately, the API call settles it, a failure rolls back
 * to the snapshot observed at start and rethrows (the caller surfaces the
 * error toast). Concurrency-safe: an operation only rolls back if no newer
 * operation has settled successfully, so a slow failed revoke never clobbers
 * a fast successful one.
 *
 * Framework-free (tested in test/frontend/optimistic.test.ts); the React hook
 * at the bottom just binds it to list state.
 */
import { useMemo, useRef } from "react";

export interface OptimisticList<T> {
	/**
	 * Apply `mutate` to the current list immediately, then await `apiCall`.
	 * Resolves with the optimistic list on success; on failure restores the
	 * pre-mutation snapshot (unless a newer operation already settled) and
	 * rethrows.
	 */
	run: (mutate: (list: T[]) => T[], apiCall: () => Promise<unknown>) => Promise<T[]>;
}

export function createOptimisticList<T>(get: () => T[], set: (list: T[]) => void): OptimisticList<T> {
	let seq = 0;
	let settled = 0; // highest sequence number that resolved successfully
	return {
		run(mutate, apiCall) {
			const id = ++seq;
			const snapshot = get();
			let next: T[];
			try {
				next = mutate(snapshot);
			} catch (cause) {
				return Promise.reject(cause);
			}
			set(next);
			return apiCall().then(
				() => {
					settled = Math.max(settled, id);
					return next;
				},
				cause => {
					// Only undo if no newer successful operation owns the state now.
					if (settled < id) set(snapshot);
					throw cause;
				},
			);
		},
	};
}

/**
 * Bind the engine to a page's list state (`items`/`setItems` from useState;
 * `items` may be null while loading). The engine instance is stable; its
 * internal mirror ref keeps consecutive optimistic ops coherent even before
 * React re-renders.
 */
export function useOptimisticList<T>(items: T[] | null, setItems: (next: T[]) => void): OptimisticList<T> {
	const mirror = useRef<T[] | null>(items);
	mirror.current = items;
	return useMemo(
		() => createOptimisticList<T>(
			() => mirror.current ?? [],
			next => {
				mirror.current = next;
				setItems(next);
			},
		),
		[setItems],
	);
}
