/**
 * Generated themes: every color's lightness is computed from perceptual contrast minimums
 * against the terminal background, so the theme adapts to whatever background the terminal
 * uses. Hue and saturation come from a built-in recipe, or from the terminal's ANSI palette
 * for the `system` theme.
 */

import {
	grayLightness,
	hexToOkhsl,
	okhslToHex,
	perceptualContrast,
	rgbToHex,
	targetLuminance,
} from "./perceptual-color.ts";

export type PerceptualMode = "dark" | "light";

/** A color family: one OKHSL hue, with saturation varying between black/white (`min`) and mid lightness (`max`). */
export interface ColorFamily {
	hue: number;
	saturation: { min: number; max: number };
}

/** The terminal background token: never emitted into a theme. */
const BACKGROUND = "background";

/** Backgrounds assumed when the terminal does not report its own. */
export const FALLBACK_BACKGROUNDS: Record<PerceptualMode, string> = { dark: "#282c34", light: "#f7f6f6" };

const PANELS = ["selectedBg", "toolPendingBg", "toolSuccessBg", "toolErrorBg"];
const MESSAGE_PANELS = ["userMessageBg", "customMessageBg"];
const TOOL_PANELS = ["toolPendingBg", "toolSuccessBg", "toolErrorBg"];

/** Minimums per mode: [dark, light]. */
const TEXT: [number, number] = [85, 85];
const PANEL_TEXT: [number, number] = [80, 80];
const COLORED: [number, number] = [45, 60];
const FAINT: [number, number] = [30, 45];
const SURFACE: [number, number] = [4.5, 10];

/** `token` must reach at least the minimum (perceptual contrast, 0-108) on each background. */
interface Rule {
	token: string;
	backgrounds: string[];
	minimum: [number, number];
}

const rule = (token: string, backgrounds: string[], minimum: [number, number]): Rule => ({
	token,
	backgrounds,
	minimum,
});
const each = (tokens: string[], backgrounds: string[], minimum: [number, number]): Rule[] =>
	tokens.map((token) => rule(token, backgrounds, minimum));

const THINKING_LEVELS = [
	"thinkingOff",
	"thinkingMinimal",
	"thinkingLow",
	"thinkingMedium",
	"thinkingHigh",
	"thinkingXhigh",
	"thinkingMax",
];

const RULES: Rule[] = [
	// Surfaces, against the terminal background.
	...each([...PANELS, ...MESSAGE_PANELS, "searchMatchBg"], [BACKGROUND], SURFACE),
	// Text hierarchy.
	rule("text", [BACKGROUND], TEXT),
	rule("text", ["selectedBg"], PANEL_TEXT),
	rule("userMessageText", ["userMessageBg"], PANEL_TEXT),
	rule("toolTitle", TOOL_PANELS, PANEL_TEXT),
	...each(["accent", "success", "error", "warning"], [BACKGROUND, ...PANELS], COLORED),
	rule("muted", [BACKGROUND, ...PANELS, "customMessageBg"], COLORED),
	rule("dim", [BACKGROUND, ...PANELS, "customMessageBg"], FAINT),
	rule("thinkingText", [BACKGROUND], COLORED),
	rule("toolArgument", TOOL_PANELS, COLORED),
	rule("toolOutput", [BACKGROUND, ...TOOL_PANELS], COLORED),
	rule("customMessageText", ["customMessageBg", ...TOOL_PANELS], COLORED),
	rule("customMessageLabel", [BACKGROUND, "customMessageBg", ...PANELS], COLORED),
	rule("searchMatchText", ["searchMatchBg"], COLORED),
	// Markdown.
	...each(
		["mdHeading", "mdLink", "mdLinkUrl", "mdCode", "mdQuote", "mdCodeBlockBorder", "mdListBullet"],
		[BACKGROUND, ...MESSAGE_PANELS],
		COLORED,
	),
	rule("mdCodeBlock", [BACKGROUND, ...MESSAGE_PANELS, ...TOOL_PANELS], COLORED),
	...each(["mdQuoteBorder", "mdHr"], [BACKGROUND, ...MESSAGE_PANELS, ...TOOL_PANELS], COLORED),
	rule("mdTableBorder", [BACKGROUND, ...MESSAGE_PANELS], FAINT),
	// Diffs and syntax.
	...each(["toolDiffAdded", "toolDiffRemoved", "toolDiffContext"], [BACKGROUND, ...TOOL_PANELS], COLORED),
	...each(
		[
			"syntaxComment",
			"syntaxKeyword",
			"syntaxFunction",
			"syntaxVariable",
			"syntaxString",
			"syntaxNumber",
			"syntaxType",
			"syntaxOperator",
			"syntaxPunctuation",
		],
		[BACKGROUND, ...MESSAGE_PANELS, ...TOOL_PANELS],
		COLORED,
	),
	// Borders and editor.
	...each(["border", "borderAccent", "bashMode"], [BACKGROUND], COLORED),
	rule("borderMuted", [BACKGROUND], FAINT),
	...THINKING_LEVELS.map((token, index): Rule => rule(token, [BACKGROUND], [25 + 3 * index, 25 + 3 * index])),
	// Fullscreen scrollbar: the thumb is measured against the track.
	rule("scrollbarTrack", [BACKGROUND], [12, 12]),
	rule("scrollbarThumb", ["scrollbarTrack"], [35, 35]),
];

/**
 * The low clip reports contrast below about 10 as 0. Minimums below this are measured
 * without it, so faint surfaces (panels, the scrollbar track) stay measurable.
 */
const LOW_CLIP_BELOW = 15;

/** Built-in color families. */
const FAMILIES: Record<string, ColorFamily> = {
	neutral: { hue: 231.49, saturation: { min: 0.02, max: 0.08 } },
	blue: { hue: 231.49, saturation: { min: 0.1, max: 0.68 } },
	green: { hue: 158.68, saturation: { min: 0.1, max: 0.76 } },
	red: { hue: 20, saturation: { min: 0.1, max: 0.92 } },
	yellow: { hue: 82.36, saturation: { min: 0.5, max: 1 } },
	orange: { hue: 52, saturation: { min: 0.12, max: 0.85 } },
	violet: { hue: 295, saturation: { min: 0.2, max: 0.6 } },
	calamine: { hue: 202.43, saturation: { min: 0.1, max: 0.74 } },
	thinkingSlate: { hue: 231.49, saturation: { min: 0.08, max: 0.2 } },
	thinkingBlue: { hue: 231.49, saturation: { min: 0.2, max: 0.45 } },
	thinkingPeriwinkle: { hue: 263.25, saturation: { min: 0.3, max: 0.6 } },
	thinkingViolet: { hue: 295, saturation: { min: 0.4, max: 0.75 } },
	thinkingMagenta: { hue: 337.5, saturation: { min: 0.5, max: 0.85 } },
	thinkingRed: { hue: 20, saturation: { min: 0.95, max: 1 } },
};

/** The built-in family of every token. */
const TOKEN_FAMILIES: Record<string, string> = {
	...Object.fromEntries(
		[
			"text",
			"userMessageText",
			"customMessageText",
			"toolTitle",
			"syntaxOperator",
			"syntaxPunctuation",
			"muted",
			"dim",
			"thinkingText",
			"toolOutput",
			"mdLinkUrl",
			"mdQuote",
			"mdQuoteBorder",
			"mdHr",
			"mdCodeBlockBorder",
			"toolDiffContext",
			"syntaxComment",
			"scrollbarTrack",
			"scrollbarThumb",
			"searchMatchText",
			"borderMuted",
			"mdTableBorder",
			"toolPendingBg",
			"thinkingOff",
		].map((token) => [token, "neutral"]),
	),
	...Object.fromEntries(
		["selectedBg", "userMessageBg", "border", "mdLink", "syntaxKeyword", "toolArgument"].map((token) => [
			token,
			"blue",
		]),
	),
	...Object.fromEntries(
		["customMessageBg", "customMessageLabel", "accent", "borderAccent", "mdCode", "mdListBullet", "syntaxType"].map(
			(token) => [token, "violet"],
		),
	),
	...Object.fromEntries(
		["toolSuccessBg", "success", "mdCodeBlock", "toolDiffAdded", "bashMode", "syntaxNumber"].map((token) => [
			token,
			"green",
		]),
	),
	...Object.fromEntries(["toolErrorBg", "error", "toolDiffRemoved"].map((token) => [token, "red"])),
	...Object.fromEntries(["warning", "mdHeading", "syntaxFunction"].map((token) => [token, "yellow"])),
	searchMatchBg: "orange",
	syntaxString: "orange",
	syntaxVariable: "calamine",
	thinkingMinimal: "thinkingSlate",
	thinkingLow: "thinkingBlue",
	thinkingMedium: "thinkingPeriwinkle",
	thinkingHigh: "thinkingViolet",
	thinkingXhigh: "thinkingMagenta",
	thinkingMax: "thinkingRed",
};

/** ANSI palette slot of each built-in family, for the `system` theme. */
const FAMILY_SLOTS: Record<string, number> = {
	red: 1,
	green: 2,
	yellow: 3,
	blue: 4,
	violet: 5,
	calamine: 6,
	neutral: 8,
};

/** Tokens whose built-in family has no ANSI slot (orange, the thinking scale) or would clash in hue. */
const TOKEN_SLOTS: Record<string, number> = {
	syntaxString: 2,
	syntaxNumber: 5,
	searchMatchBg: 3,
	thinkingOff: 8,
	thinkingMinimal: 4,
	thinkingLow: 4,
	thinkingMedium: 6,
	thinkingHigh: 5,
	thinkingXhigh: 13,
	thinkingMax: 1,
};

/** Every token a generated theme emits. */
export const PERCEPTUAL_THEME_TOKENS = Object.keys(TOKEN_FAMILIES);

/** The ANSI palette slot a token takes its hue and saturation from in the `system` theme. */
export function paletteSlot(token: string): number {
	return TOKEN_SLOTS[token] ?? FAMILY_SLOTS[TOKEN_FAMILIES[token]];
}

/**
 * Pick dark or light for a background: dark (light text) when white text has more
 * perceptual contrast on it than black text.
 */
export function perceptualMode(background: string): PerceptualMode {
	const white = Math.abs(perceptualContrast("#ffffff", background));
	const black = Math.abs(perceptualContrast("#000000", background));
	return white >= black ? "dark" : "light";
}

/** Saturation weight at a lightness: a Gaussian (center 0.5, sigma 0.25), 0 at black and white, 1 in the middle. */
function bellWeight(lightness: number): number {
	const gaussian = (x: number): number => Math.exp(-((x - 0.5) ** 2) / (2 * 0.25 ** 2));
	return (gaussian(lightness) - gaussian(0)) / (1 - gaussian(0));
}

/** Order tokens so each comes after the backgrounds it is measured on. */
function solveOrder(): string[] {
	const dependencies = new Map<string, Set<string>>();
	for (const { token, backgrounds } of RULES) {
		const set = dependencies.get(token) ?? new Set<string>();
		for (const background of backgrounds) if (background !== BACKGROUND) set.add(background);
		dependencies.set(token, set);
	}
	const order: string[] = [];
	const visit = (token: string): void => {
		if (order.includes(token)) return;
		for (const background of dependencies.get(token) ?? []) visit(background);
		order.push(token);
	};
	for (const token of dependencies.keys()) visit(token);
	return order;
}
const SOLVE_ORDER = solveOrder();

/** Full relaxation: every minimum at its lowest value. */
const MAX_RELAXATION = 2;
/** Relaxation first compresses minimums toward this readable floor, then toward 0. */
const READABLE_FLOOR = 45;

/**
 * Relax a minimum for backgrounds that cannot meet the rules (mid-range grays). From `t` 0 to 1,
 * minimums above the readable floor move toward it, so levels keep their order; from 1 to 2, all
 * minimums move toward 0.
 */
function relax(minimum: number, t: number): number {
	const compressed = minimum > READABLE_FLOOR ? minimum - (minimum - READABLE_FLOOR) * Math.min(t, 1) : minimum;
	return compressed * (1 - Math.max(0, t - 1));
}

/**
 * Compute every token's color. Each rule's inverse contrast formula gives the luminance the token
 * needs, the strictest wins, and that luminance becomes OKHSL lightness via the gray formula (exact
 * for grays, a few percent off for saturated colors).
 * @returns Hex colors by token, or undefined if a minimum is unreachable.
 */
function solve(
	familyOf: (token: string) => ColorFamily,
	mode: PerceptualMode,
	background: string,
	t: number,
): Record<string, string> | undefined {
	const colors: Record<string, string> = { [BACKGROUND]: background };
	const lighter = mode === "dark";
	const minimumIndex = lighter ? 0 : 1;
	for (const token of SOLVE_ORDER) {
		const targets = RULES.filter((candidate) => candidate.token === token).flatMap(({ backgrounds, minimum }) => {
			const value = relax(minimum[minimumIndex], t);
			return backgrounds.map((name) => targetLuminance(value, colors[name], lighter, value >= LOW_CLIP_BELOW));
		});
		const target = lighter ? Math.max(...targets) : Math.min(...targets);
		if (targets.some(Number.isNaN) || target < 0 || target > 1) return undefined;
		const { hue, saturation } = familyOf(token);
		const lightness = grayLightness(target);
		colors[token] = okhslToHex(
			hue,
			saturation.min + (saturation.max - saturation.min) * bellWeight(lightness),
			lightness,
		);
	}
	return colors;
}

export interface PerceptualThemeOptions {
	/** Terminal background, `#rrggbb`. */
	background: string;
	/** Dark themes solve lighter colors, light themes darker ones. */
	mode: PerceptualMode;
	/** The terminal's 16 ANSI colors, `#rrggbb`. When given, hue and saturation come from it. */
	palette?: string[];
}

/**
 * Generate a theme's colors. If the background cannot meet the rules, minimums are relaxed as
 * little as possible.
 * @returns Hex colors by token.
 */
export function generatePerceptualColors({
	background,
	mode,
	palette,
}: PerceptualThemeOptions): Record<string, string> {
	const paletteFamilies = palette?.map((hex): ColorFamily => {
		const { hue, saturation } = hexToOkhsl(hex);
		return { hue, saturation: { min: saturation, max: saturation } };
	});
	const familyOf = (token: string): ColorFamily =>
		paletteFamilies ? paletteFamilies[paletteSlot(token)] : FAMILIES[TOKEN_FAMILIES[token]];

	let colors = solve(familyOf, mode, background, 0);
	if (!colors) {
		// Feasibility only improves as t grows: bisect for the smallest workable t.
		let [low, high] = [0, MAX_RELAXATION];
		colors = solve(familyOf, mode, background, high);
		for (let i = 0; i < 20; i++) {
			const middle = (low + high) / 2;
			const attempt = solve(familyOf, mode, background, middle);
			if (attempt) [high, colors] = [middle, attempt];
			else low = middle;
		}
	}
	// Fully relaxed minimums are 0, which every background reaches.
	const solved = colors ?? {};
	return Object.fromEntries(PERCEPTUAL_THEME_TOKENS.map((token) => [token, solved[token]]));
}

/** Format an `{ r, g, b }` color (0-255 channels) as `#rrggbb`. */
export function rgbColorToHex({ r, g, b }: { r: number; g: number; b: number }): string {
	return rgbToHex(r, g, b);
}
