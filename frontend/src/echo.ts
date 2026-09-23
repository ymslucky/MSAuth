/**
 * Consent-page brand echo — a static, zero-dependency projection of the same
 * "identity constellation" that animates the login stage (scene.ts). A small
 * Fibonacci-distributed point sphere, tilted the same way, projected onto a
 * fixed square; vermilion accent nodes echo the audit marks. No three.js, no
 * animation: a static SVG carries the brand DNA at zero bundle/runtime cost,
 * which also satisfies prefers-reduced-motion trivially.
 *
 * Pure math here (test/frontend/echo.test.ts); the <svg> lives in Consent.tsx.
 */
import { mulberry32 } from "./art";

export interface EchoPoint {
	x: number;
	y: number;
	accent: boolean;
}

/**
 * Orthographic projection of `count` Fibonacci-sphere points with a
 * deterministic angular jitter (mulberry32 `seed` — points stay exactly on
 * the unit sphere, so the projection always fits the box), rotated by the
 * login scene's settled attitude (yaw around Y, then `tiltX` around X) and
 * mapped into a `size`×`size` box with a small margin. Accent nodes follow
 * the same stride rule as scene.ts, so their positions echo the big canvas.
 */
export function projectSphere(
	count: number,
	accents: number,
	size: number,
	seed: number = 20260924,
	tiltX = 0.32,
	yaw = 0.6,
): EchoPoint[] {
	const rand = mulberry32(seed);
	const golden = Math.PI * (3 - Math.sqrt(5));
	const scale = size / 2 - 6;
	const center = size / 2;

	const accentStride = Math.max(1, Math.round(count / accents));
	const accentIndices = new Set(
		Array.from({ length: Math.min(accents, count) }, (_, i) => Math.min(count - 1, i * accentStride)),
	);

	const points: EchoPoint[] = [];
	for (let i = 0; i < count; i++) {
		const y = 1 - (2 * (i + 0.5)) / count;
		const radius = Math.sqrt(Math.max(0, 1 - y * y));
		const theta = golden * i + (rand() - 0.5) * 0.35;
		let x = Math.cos(theta) * radius;
		let z = Math.sin(theta) * radius;
		const sy = y;
		// yaw around Y
		const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
		const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
		x = x1;
		z = z1;
		// tilt around X
		const y2 = sy * Math.cos(tiltX) - z * Math.sin(tiltX);
		points.push({
			x: Math.round((center + x * scale) * 100) / 100,
			y: Math.round((center + y2 * scale) * 100) / 100,
			accent: accentIndices.has(i),
		});
	}
	return points;
}
