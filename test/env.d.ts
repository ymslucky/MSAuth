// Type support for importing migration SQL files as raw strings.
declare module "*?raw" {
	const content: string;
	export default content;
}