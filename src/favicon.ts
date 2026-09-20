/** Hand-drawn "M" icon shared across all pages. */
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<rect x="4" y="4" width="56" height="56" rx="16" ry="11" fill="#ffe98a" stroke="#33302a" stroke-width="4"/>
	<text x="32" y="45" font-family="Segoe Print, Comic Sans MS, KaiTi, cursive" font-size="34" font-weight="700" text-anchor="middle" fill="#33302a">M</text>
</svg>`;

export const FAVICON_DATA_URI =
	"data:image/svg+xml," + encodeURIComponent(FAVICON_SVG);

export function faviconResponse(): Response {
	return new Response(FAVICON_SVG, {
		headers: {
			"content-type": "image/svg+xml",
			"cache-control": "public, max-age=604800",
		},
	});
}