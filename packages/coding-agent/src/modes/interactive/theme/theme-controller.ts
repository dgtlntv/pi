import type { TUI } from "@earendil-works/pi-tui";
import type { SettingsManager } from "../../../core/settings-manager.ts";
import {
	detectTerminalBackgroundFromEnv,
	detectTerminalBackgroundTheme,
	detectTerminalThemeForAuto,
	initTheme,
	isGeneratedThemeName,
	parseAutoThemeSetting,
	resolveThemeSetting,
	setTerminalColors,
	setTheme,
	setThemeInstance,
	type TerminalTheme,
	type Theme,
} from "./theme.ts";

type ThemeResult = { success: boolean; error?: string };

/** How long to wait for the terminal to report its colors. */
const QUERY_TIMEOUT_MS = 100;

export class InteractiveThemeController {
	private readonly ui: TUI;
	private readonly getSettingsManager: () => SettingsManager;
	private readonly showError: (message: string) => void;
	private readonly onChanged: () => void;
	private currentThemeSetting: string | undefined;
	private terminalTheme: TerminalTheme = detectTerminalBackgroundFromEnv().theme;
	private activeThemeName: string | undefined;
	private autoSyncEnabled = false;
	private terminalColorSchemeUnsubscribe: (() => void) | undefined;

	constructor(
		ui: TUI,
		options: {
			getSettingsManager: () => SettingsManager;
			showError: (message: string) => void;
			onChanged: () => void;
			initialThemeSetting?: string;
		},
	) {
		this.ui = ui;
		this.getSettingsManager = options.getSettingsManager;
		this.showError = options.showError;
		this.onChanged = options.onChanged;
		this.currentThemeSetting = options.initialThemeSetting;
		this.activeThemeName = resolveThemeSetting(
			this.currentThemeSetting ?? this.getSettingsManager().getThemeSetting(),
			this.terminalTheme,
		);
		initTheme(this.activeThemeName, true);
		this.bindTerminalColorSchemeListener();
	}

	rebindTui(): void {
		this.terminalColorSchemeUnsubscribe?.();
		this.bindTerminalColorSchemeListener();
		this.ui.setTerminalColorSchemeNotifications(this.autoSyncEnabled);
	}

	async applyFromSettings(): Promise<void> {
		const settingsManager = this.getSettingsManager();
		const themeSetting = this.currentThemeSetting ?? settingsManager.getThemeSetting();
		const autoTheme = parseAutoThemeSetting(themeSetting);
		if (autoTheme) {
			[this.terminalTheme] = await Promise.all([
				detectTerminalThemeForAuto({ ui: this.ui, timeoutMs: QUERY_TIMEOUT_MS }),
				this.refreshTerminalColors([autoTheme.lightTheme, autoTheme.darkTheme]),
			]);
			this.setAutoSync(true);
			this.applyThemeName(this.terminalTheme === "light" ? autoTheme.lightTheme : autoTheme.darkTheme, true);
			return;
		}

		if (themeSetting !== undefined) {
			await this.refreshTerminalColors([themeSetting]);
			this.setAutoSync(isGeneratedThemeName(themeSetting));
			this.applyThemeName(themeSetting, true);
			return;
		}

		// No setting: detect dark or light; both are generated themes.
		const [detection] = await Promise.all([
			detectTerminalBackgroundTheme({ ui: this.ui, timeoutMs: QUERY_TIMEOUT_MS }),
			this.refreshTerminalColors(["dark", "light"]),
		]);
		this.setAutoSync(true);
		this.terminalTheme = detection.theme;
		if (!this.applyThemeName(detection.theme).success) return;
		if (detection.confidence === "high") {
			settingsManager.setTheme(detection.theme);
			await settingsManager.flush();
		}
	}

	getThemeSelection(): string | undefined {
		return this.currentThemeSetting ?? this.getSettingsManager().getThemeSetting() ?? this.activeThemeName;
	}

	setThemeName(themeName: string, showError = false): ThemeResult {
		this.setAutoSync(isGeneratedThemeName(themeName));
		const result = this.applyThemeName(themeName, showError);
		if (result.success) {
			this.currentThemeSetting = themeName;
		}
		return result;
	}

	async setThemeSetting(themeSetting: string): Promise<void> {
		this.currentThemeSetting = themeSetting;
		await this.applyFromSettings();
	}

	setThemeInstance(themeInstance: Theme): ThemeResult {
		this.setAutoSync(false);
		setThemeInstance(themeInstance);
		this.activeThemeName = "<in-memory>";
		this.notifyChanged();
		return { success: true };
	}

	preview(themeSettingOrName: string): void {
		const themeName = resolveThemeSetting(themeSettingOrName, this.terminalTheme) ?? this.activeThemeName;
		if (!themeName) return;
		if (setTheme(themeName, true).success) {
			this.ui.invalidate();
			this.ui.requestRender();
		}
	}

	disableAutoSync(): void {
		this.setAutoSync(false);
	}

	dispose(): void {
		this.setAutoSync(false);
		this.terminalColorSchemeUnsubscribe?.();
		this.terminalColorSchemeUnsubscribe = undefined;
	}

	getTerminalTheme(): TerminalTheme {
		return this.terminalTheme;
	}

	private applyThemeName(themeName: string, showError = false): ThemeResult {
		const result = setTheme(themeName, true);
		this.activeThemeName = result.success ? themeName : "dark";
		this.notifyChanged();
		if (!result.success && showError) {
			this.showError(`Failed to load theme "${themeName}": ${result.error}\nFell back to dark theme.`);
		}
		return result;
	}

	/**
	 * Query the terminal's background and ANSI palette when a generated theme is involved, so it
	 * renders against the actual terminal colors. Queries that fail leave the colors unknown, and
	 * generated themes fall back to their default backgrounds and hues.
	 */
	private async refreshTerminalColors(themeNames: string[]): Promise<void> {
		if (!themeNames.some(isGeneratedThemeName)) return;
		const query = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
			try {
				return await run();
			} catch {
				return undefined;
			}
		};
		const [background, palette] = await Promise.all([
			query(() => this.ui.queryTerminalBackgroundColor({ timeoutMs: QUERY_TIMEOUT_MS })),
			query(() => this.ui.queryTerminalPalette({ timeoutMs: QUERY_TIMEOUT_MS })),
		]);
		setTerminalColors({ background, palette });
	}

	private notifyChanged(): void {
		this.ui.invalidate();
		this.onChanged();
	}

	private setAutoSync(enabled: boolean): void {
		if (this.autoSyncEnabled === enabled) return;
		this.autoSyncEnabled = enabled;
		this.ui.setTerminalColorSchemeNotifications(enabled);
	}

	private bindTerminalColorSchemeListener(): void {
		this.terminalColorSchemeUnsubscribe = this.ui.onTerminalColorSchemeChange((terminalTheme) =>
			this.applyTerminalTheme(terminalTheme),
		);
	}

	/**
	 * The terminal reported an appearance change. Theme pairs switch themes; generated themes are
	 * regenerated against the terminal's new colors.
	 */
	private applyTerminalTheme(terminalTheme: TerminalTheme): void {
		if (!this.autoSyncEnabled) return;
		this.terminalTheme = terminalTheme;
		const autoTheme = parseAutoThemeSetting(this.currentThemeSetting ?? this.getSettingsManager().getThemeSetting());
		const themeName = autoTheme
			? terminalTheme === "light"
				? autoTheme.lightTheme
				: autoTheme.darkTheme
			: this.activeThemeName;
		if (!themeName) return;
		if (themeName !== this.activeThemeName) {
			this.applyThemeName(themeName);
		}
		if (!isGeneratedThemeName(themeName)) return;
		void this.refreshTerminalColors([themeName]).then(() => {
			if (this.autoSyncEnabled && this.activeThemeName === themeName) this.applyThemeName(themeName);
		});
	}
}
