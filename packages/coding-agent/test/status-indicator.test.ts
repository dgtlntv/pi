import { type TUI, visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	IdleStatus,
	RetryStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

describe("status indicators", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps idle status at the same height as status indicators", () => {
		initTheme("dark");
		const idleStatus = new IdleStatus();
		const indicator = new WorkingStatusIndicator(
			{ requestRender: vi.fn() } as unknown as TUI,
			"Working on a status message that exceeds the available width...",
			{ frames: ["*"] },
		);

		const idleLines = idleStatus.render(20);
		const indicatorLines = indicator.render(20);
		expect(idleLines).toEqual([" ".repeat(20)]);
		expect(indicatorLines).toHaveLength(1);
		expect(indicatorLines[0]).toContain("Working");
		expect(visibleWidth(indicatorLines[0]!)).toBeLessThanOrEqual(20);
		indicator.dispose();
	});

	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});
});
