import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { initTheme, type TerminalTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { InteractiveThemeController } from "../src/modes/interactive/theme/theme-controller.ts";

function createUi() {
	const queryTerminalBackgroundColor = vi.fn();
	const queryTerminalColorScheme = vi.fn();
	const setTerminalColorSchemeNotifications = vi.fn();
	const setTerminalColors = vi.fn().mockResolvedValue(undefined);
	let terminalColorSchemeListener: ((terminalTheme: TerminalTheme) => void) | undefined;
	const ui = {
		invalidate: vi.fn(),
		requestRender: vi.fn(),
		setTerminalColorSchemeNotifications,
		onTerminalColorSchemeChange: vi.fn((listener: (terminalTheme: TerminalTheme) => void) => {
			terminalColorSchemeListener = listener;
			return vi.fn();
		}),
		queryTerminalBackgroundColor,
		queryTerminalColorScheme,
		setTerminalColors,
	} as unknown as TUI;
	return {
		ui,
		queryTerminalBackgroundColor,
		queryTerminalColorScheme,
		setTerminalColorSchemeNotifications,
		setTerminalColors,
		emitTerminalColorScheme: (terminalTheme: TerminalTheme) => terminalColorSchemeListener?.(terminalTheme),
	};
}

function createController(ui: TUI, getSettingsManager: () => SettingsManager, initialThemeSetting?: string) {
	return new InteractiveThemeController(ui, {
		getSettingsManager,
		showError: vi.fn(),
		onChanged: vi.fn(),
		initialThemeSetting,
	});
}

afterEach(() => {
	initTheme("dark");
	vi.unstubAllEnvs();
});

describe("InteractiveThemeController", () => {
	it("uses the initial theme without persisting it", async () => {
		const { ui, queryTerminalBackgroundColor, setTerminalColors } = createUi();
		const manager = SettingsManager.inMemory({ theme: "dark" });
		const setTheme = vi.spyOn(manager, "setTheme");
		const flush = vi.spyOn(manager, "flush");
		const controller = createController(ui, () => manager, "light");

		expect(theme.name).toBe("light");
		expect(controller.getThemeSelection()).toBe("light");
		await controller.applyFromSettings();

		expect(queryTerminalBackgroundColor).not.toHaveBeenCalled();
		expect(setTerminalColors).toHaveBeenCalledWith({
			foreground: { r: 31, g: 35, b: 40 },
			background: { r: 248, g: 248, b: 248 },
		});
		expect(setTheme).not.toHaveBeenCalled();
		expect(flush).not.toHaveBeenCalled();
	});

	it("resolves a theme pair and follows terminal appearance changes", async () => {
		vi.stubEnv("COLORFGBG", "15;0");
		const {
			ui,
			queryTerminalColorScheme,
			setTerminalColorSchemeNotifications,
			setTerminalColors,
			emitTerminalColorScheme,
		} = createUi();
		queryTerminalColorScheme.mockResolvedValue("light");
		const manager = SettingsManager.inMemory({ theme: "dark/light" });
		const controller = createController(ui, () => manager, "light/dark");

		expect(theme.name).toBe("dark");
		await controller.applyFromSettings();
		expect(theme.name).toBe("light");
		expect(setTerminalColorSchemeNotifications).toHaveBeenCalledWith(true);

		emitTerminalColorScheme("dark");
		expect(theme.name).toBe("dark");
		expect(setTerminalColors).toHaveBeenLastCalledWith({
			foreground: { r: 212, g: 212, b: 212 },
			background: { r: 24, g: 24, b: 30 },
		});
	});

	it("detects the current terminal appearance when selecting a theme pair", async () => {
		vi.stubEnv("COLORFGBG", "");
		const { ui, queryTerminalColorScheme } = createUi();
		queryTerminalColorScheme.mockResolvedValue("light");
		const manager = SettingsManager.inMemory({ theme: "dark" });
		const controller = createController(ui, () => manager);

		expect(theme.name).toBe("dark");
		await controller.setThemeSetting("light/dark");
		expect(theme.name).toBe("light");
		expect(queryTerminalColorScheme).toHaveBeenCalledOnce();
	});

	it("lets an explicit selection replace the initial theme", async () => {
		const { ui } = createUi();
		const firstManager = SettingsManager.inMemory({ theme: "dark" });
		const secondManager = SettingsManager.inMemory({ theme: "light" });
		let manager = firstManager;
		const controller = createController(ui, () => manager, "light");
		await controller.applyFromSettings();

		expect(controller.setThemeName("dark")).toEqual({ success: true });
		manager = secondManager;
		await controller.applyFromSettings();

		expect(controller.getThemeSelection()).toBe("dark");
		expect(theme.name).toBe("dark");
	});

	it("reloads theme settings when no initial theme was supplied", async () => {
		const { ui } = createUi();
		const firstManager = SettingsManager.inMemory({ theme: "dark" });
		const secondManager = SettingsManager.inMemory({ theme: "light" });
		let manager = firstManager;
		const controller = createController(ui, () => manager);
		await controller.applyFromSettings();

		firstManager.applyOverrides({ theme: "light" });
		await controller.applyFromSettings();
		expect(theme.name).toBe("light");

		secondManager.applyOverrides({ theme: "dark" });
		manager = secondManager;
		await controller.applyFromSettings();
		expect(theme.name).toBe("dark");
	});
});
