/**
 * "Identity constellation on paper" — the login-stage scene.
 *
 * A slowly turning sphere of ~700 fine ink points (Fibonacci-distributed,
 * so the density is perfectly even) threaded with sparse hairline segments
 * between nearest neighbours. A few dozen nodes glow vermilion — the audit
 * marks of the identity graph — and a single fine orbit ring frames the
 * whole instrument. The canvas stays transparent: the page provides the
 * bone paper; a scrim on top guarantees text contrast.
 *
 * three.js is loaded through a dynamic `import("three")` so it lands in its
 * own lazy chunk and the console bundle never pays for it. The mount
 * signature is synchronous; the returned cleanup also cancels a load that
 * resolves after unmount. `prefers-reduced-motion` renders exactly one
 * static frame and stops.
 */
import type * as ThreeNS from "three";
import { scenePalette, type ScenePalette } from "./theme";

const NODE_COUNT = 700;
const ACCENT_COUNT = 36;
const NEIGHBORS = 2;
/** Hairline cutoff: segments longer than this are dropped (keeps the mesh airy). */
const EDGE_CUTOFF = 0.35;

export interface Constellation {
	/** xyz triples for every node, unit sphere. */
	positions: Float32Array;
	/** Index pairs (a < b) of hairline segments. */
	edges: Uint32Array;
	/** Ascending node indices carrying vermilion glow. */
	accents: Uint32Array;
}

/**
 * Deterministic constellation geometry: Fibonacci-sphere nodes, k-nearest
 * hairline edges under `EDGE_CUTOFF`, stride-spread accent nodes.
 */
export function buildConstellation(count: number, accents: number, neighbors: number): Constellation {
	const positions = new Float32Array(count * 3);
	const golden = Math.PI * (3 - Math.sqrt(5));
	for (let i = 0; i < count; i++) {
		const y = 1 - (2 * (i + 0.5)) / count;
		const radius = Math.sqrt(Math.max(0, 1 - y * y));
		const theta = golden * i;
		positions[i * 3] = Math.cos(theta) * radius;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = Math.sin(theta) * radius;
	}

	const edges: number[] = [];
	const maxEdges = Math.min(neighbors, count - 1);
	for (let i = 0; i < count; i++) {
		// k nearest neighbours by squared distance (count ≤ 700, so O(n²) is fine at mount).
		const best: { index: number; d2: number }[] = [];
		for (let j = 0; j < count; j++) {
			if (j === i) continue;
			const dx = positions[i * 3] - positions[j * 3];
			const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
			const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
			const d2 = dx * dx + dy * dy + dz * dz;
			if (best.length < maxEdges) {
				best.push({ index: j, d2 });
				best.sort((a, b) => a.d2 - b.d2);
			} else if (d2 < best[maxEdges - 1].d2) {
				best[maxEdges - 1] = { index: j, d2 };
				best.sort((a, b) => a.d2 - b.d2);
			}
		}
		for (const { index, d2 } of best) {
			if (Math.sqrt(d2) > EDGE_CUTOFF) continue;
			const a = Math.min(i, index);
			const b = Math.max(i, index);
			edges.push(a, b);
		}
	}
	// Canonical pair ordering alone can leave duplicates when two nodes are
	// mutual nearest neighbours — dedupe while preserving order.
	const unique = Array.from(new Set(edges)).length === edges.length
		? edges
		: [...dedupePairs(edges)];

	const accentIndices: number[] = [];
	for (let i = 0; i < accents; i++) {
		accentIndices.push(Math.min(count - 1, Math.round((i * count) / accents)));
	}

	return {
		positions,
		edges: new Uint32Array(unique),
		accents: new Uint32Array(accentIndices),
	};
}

function dedupePairs(edges: number[]): number[] {
	const seen = new Set<string>();
	const out: number[] = [];
	for (let i = 0; i < edges.length; i += 2) {
		const key = `${edges[i]}:${edges[i + 1]}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(edges[i], edges[i + 1]);
	}
	return out;
}

/** Max tilt for pointer parallax: ~8°. */
const PARALLAX = 0.14;
/** Idle auto-rotation, rad/s — well under the 0.05 ceiling. */
const AUTO_SPIN = 0.038;

export function mountLoginScene(canvas: HTMLCanvasElement, palette: ScenePalette = scenePalette("light")): () => void {
	let disposed = false;
	let teardown: (() => void) | null = null;

	void import("three")
		.then(THREE => {
			if (disposed) return;
			teardown = startScene(THREE, canvas, palette);
		})
		.catch(() => undefined); // offline / blocked — the CSS fallback stays

	return () => {
		disposed = true;
		teardown?.();
		teardown = null;
	};
}

type Three = typeof ThreeNS;

function startScene(THREE: Three, canvas: HTMLCanvasElement, palette: ScenePalette): () => void {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.setClearColor(0x000000, 0);
	renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
	camera.position.set(0, 0, 3.9);

	const group = new THREE.Group();
	scene.add(group);

	const constellation = buildConstellation(NODE_COUNT, ACCENT_COUNT, NEIGHBORS);

	// fine ink points
	const nodeGeometry = new THREE.BufferGeometry();
	nodeGeometry.setAttribute("position", new THREE.BufferAttribute(constellation.positions, 3));
	const nodeMaterial = new THREE.PointsMaterial({
		color: palette.ink, size: 0.017, sizeAttenuation: true, transparent: true, opacity: palette.nodeOpacity, depthWrite: false,
	});
	group.add(new THREE.Points(nodeGeometry, nodeMaterial));

	// sparse hairline segments
	const edgePositions = new Float32Array(constellation.edges.length * 3);
	for (let e = 0; e < constellation.edges.length; e++) {
		const node = constellation.edges[e];
		edgePositions[e * 3] = constellation.positions[node * 3];
		edgePositions[e * 3 + 1] = constellation.positions[node * 3 + 1];
		edgePositions[e * 3 + 2] = constellation.positions[node * 3 + 2];
	}
	const edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
	const edgeMaterial = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: palette.edgeOpacity, depthWrite: false });
	group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

	// vermilion nodes: crisp core + wide faint halo (glow without additive bloom)
	const accentPositions = new Float32Array(constellation.accents.length * 3);
	for (let i = 0; i < constellation.accents.length; i++) {
		const node = constellation.accents[i];
		accentPositions[i * 3] = constellation.positions[node * 3];
		accentPositions[i * 3 + 1] = constellation.positions[node * 3 + 1];
		accentPositions[i * 3 + 2] = constellation.positions[node * 3 + 2];
	}
	const accentGeometry = new THREE.BufferGeometry();
	accentGeometry.setAttribute("position", new THREE.BufferAttribute(accentPositions, 3));
	const coreMaterial = new THREE.PointsMaterial({
		color: palette.accent, size: 0.062, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false,
	});
	const core = new THREE.Points(accentGeometry, coreMaterial);
	group.add(core);
	const haloMaterial = new THREE.PointsMaterial({
		color: palette.accent, size: 0.17, sizeAttenuation: true, transparent: true, opacity: 0.16, depthWrite: false,
	});
	const halo = new THREE.Points(accentGeometry, haloMaterial);
	group.add(halo);

	// one fine orbit ring — the instrument's bezel
	const ringPoints: ThreeNS.Vector3[] = [];
	for (let i = 0; i < 128; i++) {
		const angle = (i / 128) * Math.PI * 2;
		ringPoints.push(new THREE.Vector3(Math.cos(angle) * 1.24, 0, Math.sin(angle) * 1.24));
	}
	const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
	const ringMaterial = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: palette.ringOpacity, depthWrite: false });
	const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
	ring.rotation.x = 0.32;
	group.add(ring);

	// a settled starting attitude: slightly tilted, never flat-on
	group.rotation.x = 0.11;
	group.rotation.y = 0.6;

	const resize = (): void => {
		const width = canvas.clientWidth || 1;
		const height = canvas.clientHeight || 1;
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	};
	resize();

	const observer = new ResizeObserver(() => {
		resize();
		if (reduced.matches) renderer.render(scene, camera);
	});
	observer.observe(canvas);

	// pointer parallax targets, lerped in the frame loop
	let targetX = 0;
	let targetY = 0;
	const onPointer = (event: PointerEvent): void => {
		targetY = ((event.clientX / window.innerWidth) * 2 - 1) * PARALLAX;
		targetX = ((event.clientY / window.innerHeight) * 2 - 1) * PARALLAX;
	};
	window.addEventListener("pointermove", onPointer, { passive: true });

	let raf = 0;
	let last = performance.now();
	const tiltX = group.rotation.x; // base tilt; parallax eases around it

	const frame = (now: number): void => {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		const time = now / 1000;
		group.rotation.y += AUTO_SPIN * dt;
		group.rotation.x += (tiltX - targetX - group.rotation.x) * Math.min(1, dt * 3.2);
		group.rotation.z += (targetY * 0.4 - group.rotation.z) * Math.min(1, dt * 3.2);
		haloMaterial.opacity = palette.haloOpacity + 0.07 * Math.sin(time * 0.9);
		group.position.y = Math.sin(time * 0.22) * 0.02;
		renderer.render(scene, camera);
		raf = requestAnimationFrame(frame);
	};

	if (reduced.matches) {
		// one settled static frame; resize re-renders it, nothing animates
		renderer.render(scene, camera);
		return () => {
			observer.disconnect();
			window.removeEventListener("pointermove", onPointer);
			disposeAll(THREE, renderer, [nodeGeometry, edgeGeometry, accentGeometry, ringGeometry], [nodeMaterial, edgeMaterial, coreMaterial, haloMaterial, ringMaterial]);
		};
	}

	// Tab hidden → drop the render loop; visible again → resume cleanly.
	const onVisibility = (): void => {
		if (document.hidden) {
			if (raf) { cancelAnimationFrame(raf); raf = 0; }
		} else if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	};
	document.addEventListener("visibilitychange", onVisibility);

	raf = requestAnimationFrame(frame);
	return () => {
		cancelAnimationFrame(raf);
		document.removeEventListener("visibilitychange", onVisibility);
		observer.disconnect();
		window.removeEventListener("pointermove", onPointer);
		disposeAll(THREE, renderer, [nodeGeometry, edgeGeometry, accentGeometry, ringGeometry], [nodeMaterial, edgeMaterial, coreMaterial, haloMaterial, ringMaterial]);
	};
}

function disposeAll(_three: Three, renderer: ThreeNS.WebGLRenderer, geometries: ThreeNS.BufferGeometry[], materials: ThreeNS.Material[]): void {
	for (const geometry of geometries) geometry.dispose();
	for (const material of materials) material.dispose();
	renderer.dispose();
}
