import { describe, expect, it } from "vitest";
import { generatePerceptualColors } from "../src/modes/interactive/theme/perceptual-theme.ts";
import { Theme } from "../src/modes/interactive/theme/theme.ts";

const BACKGROUNDS = new Set([
	"selectedBg",
	"searchMatchBg",
	"userMessageBg",
	"customMessageBg",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
]);

/** The 256-color index a hex color renders as, through a theme's accent. */
function indexFor(hex: string): number {
	const colors = { ...generatePerceptualColors({ background: "#282c34", mode: "dark" }), accent: hex };
	const fg = Object.fromEntries(Object.entries(colors).filter(([token]) => !BACKGROUNDS.has(token)));
	const bg = Object.fromEntries(Object.entries(colors).filter(([token]) => BACKGROUNDS.has(token)));
	const theme = new Theme(
		fg as ConstructorParameters<typeof Theme>[0],
		bg as ConstructorParameters<typeof Theme>[1],
		"256color",
	);
	return Number(theme.getFgAnsi("accent").match(/38;5;(\d+)m/)?.[1]);
}

describe("256-color fallback", () => {
	it("picks the xterm color with the smallest DeltaEOK", () => {
		// Pi's previous weighted-RGB match chose cube color 145 (#afafaf, DeltaEOK 0.036).
		expect(indexFor("#9ea6aa")).toBe(248); // #a8a8a8, DeltaEOK 0.016
		expect(indexFor("#ff0000")).toBe(196);
		expect(indexFor("#000000")).toBe(16);
		expect(indexFor("#ffffff")).toBe(231);
	});

	it("never uses colors 0-15, which each terminal defines itself", () => {
		for (const hex of ["#800000", "#008000", "#c0c0c0", "#808080"]) {
			expect(indexFor(hex)).toBeGreaterThanOrEqual(16);
		}
	});
});
