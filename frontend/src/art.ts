/**
 * "The Quiet Ledger" — generative hero art for the Overview page.
 *
 * A calm surface where bookkeeping becomes weather: hundreds of short ink
 * strokes drift along a layered value-noise flow field, like ruled ledger
 * lines being written. Every ~2% of strokes is a vermilion audit mark —
 * slightly longer, faintly louder. Deterministic per seed; no UI controls.
 * The palette comes from the theme module (frontend/src/theme.ts): dark mode
 * inks are brighter with a lower alpha scale.
 */
import { ledgerPalette, type LedgerPalette } from "./theme";

/** Small, fast, deterministic 32-bit PRNG (exported for tests). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface Stroke {
	x: number;
	y: number;
	len: number;
	speed: number;
	alpha: number;
	delay: number;
	audit: boolean;
	phase: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Layered value noise: lattice values + bilinear smoothing, 3 octaves. */
function makeNoise(rand: () => number) {
	const lattice = new Float32Array(256 * 256);
	for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
	const at = (x: number, y: number) => lattice[((y & 255) << 8) | (x & 255)];
	const valueAt = (x: number, y: number): number => {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const sx = smooth(x - xi);
		const sy = smooth(y - yi);
		return lerp(
			lerp(at(xi, yi), at(xi + 1, yi), sx),
			lerp(at(xi, yi + 1), at(xi + 1, yi + 1), sx),
			sy,
		);
	};
	return (x: number, y: number): number => {
		let sum = 0;
		let amp = 1;
		let freq = 1;
		let norm = 0;
		for (let octave = 0; octave < 3; octave++) {
			sum += valueAt(x * freq, y * freq) * amp;
			norm += amp;
			amp *= 0.55;
			freq *= 2.13;
		}
		return sum / norm;
	};
}

export function mountLedgerArt(
	canvas: HTMLCanvasElement,
	seed: number = 20260923,
	palette: LedgerPalette = ledgerPalette("light"),
): () => void {
	const context = canvas.getContext("2d");
	if (!context) return () => undefined;

	const rand = mulberry32(seed);
	const noise = makeNoise(rand);

	// Stroke population: scale with area, hard cap 700. Fixed params per stroke.
	let strokes: Stroke[] = [];
	let width = 0;
	let height = 0;

	const buildStrokes = (): void => {
		const count = Math.min(700, Math.max(220, Math.round((width * height) / 2600)));
		strokes = Array.from({ length: count }, (_, index) => {
			const audit = rand() < 0.02;
			// Density rises toward the right third; the left stays airy for the greeting.
			const x = width * (0.08 + 0.92 * Math.pow(rand(), 0.55));
			const y = height * (0.06 + 0.88 * rand());
			return {
				x,
				y,
				len: audit ? 26 + rand() * 20 : 9 + rand() * 17,
				speed: 2.5 + rand() * 3.5, // px/s — never more than 6
				alpha: audit ? 0.65 : 0.06 + rand() * 0.06,
				delay: (index / count) * 900 + rand() * 300,
				audit,
				phase: rand() * Math.PI * 2,
			};
		});
	};

	const resize = (): void => {
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.max(1, Math.round(width * dpr));
		canvas.height = Math.max(1, Math.round(height * dpr));
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.lineCap = "round";
		buildStrokes();
	};

	/** Field angle: a gentle undulation around horizontal (ruled lines). */
	const angleAt = (x: number, y: number, time: number): number =>
		(noise(x / 340 + time * 0.012, y / 190 + noise(y / 260, x / 300 + time * 0.008) * 0.35) - 0.5) * 1.05;

	const drawStroke = (stroke: Stroke, time: number, fadeIn: number): void => {
		const angle = angleAt(stroke.x, stroke.y, time);
		const wobble = Math.sin(time * 0.35 + stroke.phase) * 0.06;
		const cos = Math.cos(angle + wobble);
		const sin = Math.sin(angle + wobble) * 0.5;
		const half = stroke.len / 2;
		const tint = stroke.audit ? palette.vermilion : palette.ink;
		const alpha = stroke.alpha * palette.alphaScale * fadeIn * (0.82 + 0.18 * Math.sin(stroke.phase + time * 0.2));
		context.strokeStyle = `rgba(${tint.r},${tint.g},${tint.b},${alpha.toFixed(3)})`;
		context.lineWidth = 1;
		context.beginPath();
		context.moveTo(stroke.x - cos * half, stroke.y - sin * half);
		context.lineTo(stroke.x + cos * half, stroke.y + sin * half);
		context.stroke();
	};

	const step = (stroke: Stroke, dt: number, time: number): void => {
		const angle = angleAt(stroke.x, stroke.y, time);
		stroke.x += Math.cos(angle) * stroke.speed * dt;
		stroke.y += Math.sin(angle) * stroke.speed * dt * 0.5;
		if (stroke.x > width + 24) { stroke.x = -24; stroke.y = height * (0.06 + 0.88 * ((stroke.y / height + 0.13) % 0.88)); }
		if (stroke.x < -26) stroke.x = width + 24;
		if (stroke.y > height + 24) stroke.y = -24;
		if (stroke.y < -26) stroke.y = height + 24;
	};

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

	let raf = 0;
	let last = 0;
	const start = performance.now();

	const frame = (now: number): void => {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		const time = (now - start) / 1000;
		context.clearRect(0, 0, width, height);
		for (const stroke of strokes) {
			const fadeIn = Math.min(1, Math.max(0, (time * 1000 - stroke.delay) / 550));
			if (fadeIn <= 0) continue;
			step(stroke, dt, time);
			drawStroke(stroke, time, fadeIn);
		}
		raf = requestAnimationFrame(frame);
	};

	/** One fully-faded-in frame, no loop — reduced-motion contract. */
	const staticFrame = (): void => {
		context.clearRect(0, 0, width, height);
		for (const stroke of strokes) drawStroke(stroke, 4, 1);
	};

	const onResize = (): void => {
		resize();
		if (reduced.matches) staticFrame();
	};

	resize();
	if (reduced.matches) {
		staticFrame();
		reduced.addEventListener("change", onResize);
		window.addEventListener("resize", onResize);
		return () => {
			reduced.removeEventListener("change", onResize);
			window.removeEventListener("resize", onResize);
		};
	}

	last = start;
	raf = requestAnimationFrame(frame);
	window.addEventListener("resize", onResize);
	return () => {
		cancelAnimationFrame(raf);
		window.removeEventListener("resize", onResize);
	};
}
