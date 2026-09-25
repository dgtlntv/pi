import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { hexToOkhsl, okhslToHex, perceptualContrast } from "../src/modes/interactive/theme/perceptual-color.ts";
import {
	FALLBACK_BACKGROUNDS,
	generatePerceptualColors,
	PERCEPTUAL_THEME_TOKENS,
	paletteSlot,
	perceptualMode,
} from "../src/modes/interactive/theme/perceptual-theme.ts";
import {
	getAvailableThemes,
	getResolvedThemeColors,
	isLightTheme,
	setTerminalColors,
} from "../src/modes/interactive/theme/theme.ts";

/** Ghostty's default palette. */
const GHOSTTY_PALETTE = [
	"#1d1f21",
	"#cc6666",
	"#b5bd68",
	"#f0c674",
	"#81a2be",
	"#b294bb",
	"#8abeb7",
	"#c5c8c6",
	"#666666",
	"#d54e53",
	"#b9ca4a",
	"#e7c547",
	"#7aa6da",
	"#c397d8",
	"#70c0b1",
	"#eaeaea",
];

const toRgb = (hex: string) => ({
	r: parseInt(hex.slice(1, 3), 16),
	g: parseInt(hex.slice(3, 5), 16),
	b: parseInt(hex.slice(5, 7), 16),
});
const contrast = (text: string, background: string) => Math.abs(perceptualContrast(text, background));
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

afterEach(() => setTerminalColors({}));

describe("perceptual color math", () => {
	it("converts OKHSL to hex like Color.js", () => {
		expect(okhslToHex(0, 0, 0)).toBe("#000000");
		expect(okhslToHex(0, 0, 1)).toBe("#ffffff");
		expect(okhslToHex(250, 0.05, 0.9)).toBe("#e1e3e5");
		expect(okhslToHex(20, 1, 0.6)).toBe("#ff3752");
	});

	it("reads hue and saturation back from hex", () => {
		for (const [hue, saturation] of [
			[20, 0.9],
			[158.68, 0.5],
			[231.49, 0.3],
		]) {
			const read = hexToOkhsl(okhslToHex(hue, saturation, 0.6));
			expect(hueDistance(read.hue, hue)).toBeLessThan(1);
			expect(Math.abs(read.saturation - saturation)).toBeLessThan(0.02);
		}
		expect(hexToOkhsl("#666666").saturation).toBe(0);
	});

	it("measures perceptual contrast directionally", () => {
		expect(perceptualContrast("#000000", "#ffffff")).toBeCloseTo(106.04, 1);
		expect(perceptualContrast("#ffffff", "#000000")).toBeCloseTo(-107.88, 1);
	});
});

describe("generated themes", () => {
	it("emit every color role in the theme schema", () => {
		const schema = JSON.parse(
			readFileSync(new URL("../src/modes/interactive/theme/theme-schema.json", import.meta.url), "utf-8"),
		) as { properties: { colors: { properties: Record<string, unknown> } } };
		expect([...PERCEPTUAL_THEME_TOKENS].sort()).toEqual(Object.keys(schema.properties.colors.properties).sort());
		const colors = generatePerceptualColors({ background: FALLBACK_BACKGROUNDS.dark, mode: "dark" });
		expect(Object.values(colors).every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true);
	});

	it("pick the mode by which of white or black text has more contrast", () => {
		expect(perceptualMode("#282c34")).toBe("dark");
		expect(perceptualMode("#f7f6f6")).toBe("light");
		expect(perceptualMode("#1e1e2e")).toBe("dark");
	});

	it("keep text more prominent than muted, and muted than dim", () => {
		for (const mode of ["dark", "light"] as const) {
			const background = FALLBACK_BACKGROUNDS[mode];
			const colors = generatePerceptualColors({ background, mode });
			const onCanvas = (token: string) => contrast(colors[token], background);
			expect(onCanvas("text")).toBeGreaterThan(onCanvas("muted"));
			expect(onCanvas("muted")).toBeGreaterThan(onCanvas("dim"));
			expect(onCanvas("text")).toBeGreaterThan(80);
		}
	});

	it("follow the terminal background", () => {
		const colors = generatePerceptualColors({ background: "#000000", mode: "dark" });
		expect(colors.text).not.toBe(generatePerceptualColors({ background: "#282c34", mode: "dark" }).text);
		expect(contrast(colors.text, "#000000")).toBeGreaterThan(80);
	});

	it("relax minimums on a mid-gray background instead of failing", () => {
		const colors = generatePerceptualColors({ background: "#777777", mode: "dark" });
		expect(contrast(colors.text, "#777777")).toBeGreaterThan(contrast(colors.dim, "#777777"));
	});
});

describe("system theme", () => {
	it("takes hue and saturation from the ANSI palette", () => {
		const colors = generatePerceptualColors({ background: "#282c34", mode: "dark", palette: GHOSTTY_PALETTE });
		for (const token of ["error", "success", "warning", "border", "accent", "syntaxVariable", "thinkingXhigh"]) {
			const expected = hexToOkhsl(GHOSTTY_PALETTE[paletteSlot(token)]).hue;
			expect(hueDistance(hexToOkhsl(colors[token]).hue, expected), token).toBeLessThan(8);
		}
		// Panels near the background keep the palette's hue but calm its saturation.
		expect(hexToOkhsl(colors.toolSuccessBg).saturation).toBeLessThan(hexToOkhsl(GHOSTTY_PALETTE[2]).saturation);
		// Bright black is gray, so neutral text is gray.
		const { r, g, b } = toRgb(colors.text);
		expect(r === g && g === b).toBe(true);
	});

	it("calms saturated panels near a light background while keeping text faithful", () => {
		// Catppuccin Latte: very saturated, mid-lightness palette colors on a near-white background.
		const latte = [
			"#5c5f77",
			"#d20f39",
			"#40a02b",
			"#df8e1d",
			"#1e66f5",
			"#ea76cb",
			"#179299",
			"#acb0be",
			"#6c6f85",
			"#de293e",
			"#49af3d",
			"#eea02d",
			"#456eff",
			"#fe85d8",
			"#2d9fa8",
			"#bcc0cc",
		];
		const colors = generatePerceptualColors({ background: "#eff1f5", mode: "light", palette: latte });
		expect(hexToOkhsl(colors.toolSuccessBg).saturation).toBeLessThan(0.4);
		expect(hexToOkhsl(colors.success).saturation).toBeGreaterThan(0.9);
	});

	it("uses the terminal's foreground for text, never fainter than muted plus a margin", () => {
		const clear = generatePerceptualColors({
			background: "#282c34",
			mode: "dark",
			palette: GHOSTTY_PALETTE,
			foreground: "#ffffff",
		});
		expect([clear.text, clear.userMessageText, clear.toolTitle]).toEqual(["", "", ""]);

		const faint = generatePerceptualColors({
			background: "#282c34",
			mode: "dark",
			palette: GHOSTTY_PALETTE,
			foreground: "#5f7f7f",
		});
		expect(contrast(faint.text, "#282c34")).toBeGreaterThanOrEqual(contrast(faint.muted, "#282c34") + 9.5);
		expect(hueDistance(hexToOkhsl(faint.text).hue, hexToOkhsl("#5f7f7f").hue)).toBeLessThan(8);
	});

	it("maps families without an ANSI slot onto existing slots", () => {
		expect(paletteSlot("syntaxString")).toBe(2);
		expect(paletteSlot("syntaxNumber")).toBe(5);
		expect(paletteSlot("searchMatchBg")).toBe(3);
		expect(paletteSlot("thinkingMedium")).toBe(6);
		expect(paletteSlot("thinkingMax")).toBe(1);
	});

	it("is a built-in theme that follows the terminal's colors", () => {
		expect(getAvailableThemes()).toEqual(expect.arrayContaining(["dark", "light", "system"]));

		setTerminalColors({ background: toRgb("#f7f6f6"), palette: GHOSTTY_PALETTE.map(toRgb) });
		const system = getResolvedThemeColors("system");
		expect(isLightTheme("system")).toBe(true);
		expect(hueDistance(hexToOkhsl(system.error).hue, hexToOkhsl("#cc6666").hue)).toBeLessThan(8);

		// Without a palette, system matches the generated theme for the background's mode.
		setTerminalColors({ background: toRgb("#f7f6f6") });
		expect(getResolvedThemeColors("system")).toEqual(getResolvedThemeColors("light"));
	});

	it("keeps dark and light in their mode, falling back to a default background", () => {
		setTerminalColors({ background: toRgb("#f7f6f6") });
		expect(getResolvedThemeColors("dark")).toEqual(
			generatePerceptualColors({ background: FALLBACK_BACKGROUNDS.dark, mode: "dark" }),
		);
		setTerminalColors({ background: toRgb("#000000") });
		expect(getResolvedThemeColors("dark")).toEqual(generatePerceptualColors({ background: "#000000", mode: "dark" }));
	});
});
