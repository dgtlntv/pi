import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadThemeFromPath } from "../src/modes/interactive/theme/theme.ts";

const tempDirs: string[] = [];

interface TestThemeJson {
	name: string;
	fullscreenPadding?: Partial<{ top: number; right: number; bottom: number; left: number }>;
	colors: Record<string, string | number>;
}

function loadDarkTheme(): TestThemeJson {
	return JSON.parse(
		readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf8"),
	) as TestThemeJson;
}

function writeTheme(theme: TestThemeJson): string {
	const testDir = mkdtempSync(join(tmpdir(), "pi-scrollbar-theme-"));
	tempDirs.push(testDir);
	const themePath = join(testDir, `${theme.name}.json`);
	writeFileSync(themePath, JSON.stringify(theme));
	return themePath;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("fullscreen theme settings", () => {
	it("uses per-side fullscreen padding with defaults for omitted sides", () => {
		const themeJson = loadDarkTheme();
		themeJson.name = "fullscreen-padding-theme";
		delete themeJson.fullscreenPadding;
		expect(loadThemeFromPath(writeTheme(themeJson), "truecolor").fullscreenPadding).toEqual({
			top: 0,
			right: 1,
			bottom: 1,
			left: 1,
		});

		themeJson.fullscreenPadding = { top: 2, left: 3 };
		expect(loadThemeFromPath(writeTheme(themeJson), "truecolor").fullscreenPadding).toEqual({
			top: 2,
			right: 1,
			bottom: 1,
			left: 3,
		});
	});

	it("rejects negative fullscreen padding", () => {
		const themeJson = loadDarkTheme();
		themeJson.name = "invalid-fullscreen-padding-theme";
		themeJson.fullscreenPadding = { bottom: -1 };
		expect(() => loadThemeFromPath(writeTheme(themeJson), "truecolor")).toThrow("fullscreenPadding");
	});

	it.each(["scrollbarTrack", "scrollbarThumb"] as const)("requires %s", (token) => {
		const themeJson = loadDarkTheme();
		themeJson.name = `missing-${token}-theme`;
		delete themeJson.colors[token];

		expect(() => loadThemeFromPath(writeTheme(themeJson), "truecolor")).toThrow(token);
	});

	it("uses explicitly configured scrollbar colors", () => {
		const themeJson = loadDarkTheme();
		themeJson.name = "custom-scrollbar-theme";
		themeJson.colors.scrollbarTrack = "#654321";
		themeJson.colors.scrollbarThumb = "#123456";

		const loadedTheme = loadThemeFromPath(writeTheme(themeJson), "truecolor");
		expect(loadedTheme.getFgAnsi("scrollbarTrack")).toBe("\x1b[38;2;101;67;33m");
		expect(loadedTheme.getFgAnsi("scrollbarThumb")).toBe("\x1b[38;2;18;52;86m");
	});

	it("falls back to existing selection and text colors for search highlights", () => {
		const themeJson = loadDarkTheme();
		themeJson.name = "legacy-search-theme";
		delete themeJson.colors.searchMatchBg;
		delete themeJson.colors.searchMatchText;

		const loadedTheme = loadThemeFromPath(writeTheme(themeJson), "truecolor");
		expect(loadedTheme.getBgAnsi("searchMatchBg")).toBe(loadedTheme.getBgAnsi("selectedBg"));
		expect(loadedTheme.getFgAnsi("searchMatchText")).toBe(loadedTheme.getFgAnsi("text"));
	});

	it("uses explicitly configured search highlight colors", () => {
		const themeJson = loadDarkTheme();
		themeJson.name = "custom-search-theme";
		themeJson.colors.searchMatchBg = "#112233";
		themeJson.colors.searchMatchText = "#223344";

		const loadedTheme = loadThemeFromPath(writeTheme(themeJson), "truecolor");
		expect(loadedTheme.getBgAnsi("searchMatchBg")).toBe("\x1b[48;2;17;34;51m");
		expect(loadedTheme.getFgAnsi("searchMatchText")).toBe("\x1b[38;2;34;51;68m");
	});
});
