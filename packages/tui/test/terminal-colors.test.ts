import assert from "node:assert";
import { describe, it } from "node:test";
import {
	type Component,
	parseOsc4PaletteColor,
	parseOsc11BackgroundColor,
	parseTerminalColorSchemeReport,
	type Terminal,
	type TUI,
	TuiMainScreen,
} from "../src/index.ts";

class TestTerminal implements Terminal {
	private inputHandler?: (data: string) => void;
	private resizeHandler?: () => void;
	private readonly columnCount: number;
	private readonly rowCount: number;
	readonly writes: string[] = [];

	constructor(columnCount = 80, rowCount = 24) {
		this.columnCount = columnCount;
		this.rowCount = rowCount;
	}

	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;
	}

	stop(): void {
		this.inputHandler = undefined;
		this.resizeHandler = undefined;
	}

	async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

	write(data: string): void {
		this.writes.push(data);
	}

	get columns(): number {
		return this.columnCount;
	}

	get rows(): number {
		return this.rowCount;
	}

	get kittyProtocolActive(): boolean {
		return false;
	}

	moveBy(_lines: number): void {}

	hideCursor(): void {}

	showCursor(): void {}

	clearLine(): void {}

	clearFromCursor(): void {}

	clearScreen(): void {}

	setTitle(_title: string): void {}

	setProgress(_active: boolean): void {}

	sendInput(data: string): void {
		this.inputHandler?.(data);
	}

	sendResize(): void {
		this.resizeHandler?.();
	}
}

class InputRecorder implements Component {
	readonly inputs: string[] = [];

	render(_width: number): string[] {
		return [];
	}

	handleInput(data: string): void {
		this.inputs.push(data);
	}

	invalidate(): void {}
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("parseOsc11BackgroundColor", () => {
	it("parses 16-bit OSC 11 rgb responses", () => {
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;rgb:0000/8000/ffff\x07"), {
			r: 0,
			g: 128,
			b: 255,
		});
	});

	it("parses OSC 11 hex responses", () => {
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;#ffffff\x1b\\"), { r: 255, g: 255, b: 255 });
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;#000000\x07"), { r: 0, g: 0, b: 0 });
	});

	it("rejects non-strict OSC 11 responses", () => {
		assert.strictEqual(parseOsc11BackgroundColor(`x\x1b]11;#ffffff\x07`), undefined);
		assert.strictEqual(parseOsc11BackgroundColor("\x1b]10;#ffffff\x07"), undefined);
		assert.strictEqual(parseOsc11BackgroundColor("\x1b]11;#ffffff\x07x"), undefined);
	});
});

describe("parseTerminalColorSchemeReport", () => {
	it("parses color scheme reports", () => {
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;1n"), "dark");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;2n"), "light");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;2n\x1b[?997;1n\x1b[?997;1n"), "dark");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;1n\x1b[?997;2n\x1b[?997;2n"), "light");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;3n"), undefined);
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?996n"), undefined);
		assert.strictEqual(parseTerminalColorSchemeReport("x\x1b[?997;1n"), undefined);
	});
});

describe("TUI.queryTerminalBackgroundColor", () => {
	it("writes OSC 11 query and resolves with the parsed RGB reply", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		tui.start();
		try {
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });
			assert.ok(terminal.writes.includes("\x1b]11;?\x07"));

			terminal.sendInput("\x1b]11;#ffffff\x07");

			assert.deepStrictEqual(await query, { r: 255, g: 255, b: 255 });
		} finally {
			tui.stop();
		}
	});

	it("consumes OSC 11 replies before input listeners and focused component dispatch", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		const component = new InputRecorder();
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });

			terminal.sendInput("\x1b]11;#000000\x07");

			assert.deepStrictEqual(await query, { r: 0, g: 0, b: 0 });
			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});

	it("consumes unparseable strict OSC 11 replies and resolves undefined", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		const component = new InputRecorder();
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });

			terminal.sendInput("\x1b]11;not-a-color\x07");

			assert.strictEqual(await query, undefined);
			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});

	it("dispatches non-matching input normally while waiting for an OSC 11 reply", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		const component = new InputRecorder();
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			let settled = false;
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 }).then((rgb) => {
				settled = true;
				return rgb;
			});

			terminal.sendInput("x");
			await Promise.resolve();

			assert.strictEqual(settled, false);
			assert.deepStrictEqual(listenerInputs, ["x"]);
			assert.deepStrictEqual(component.inputs, ["x"]);

			terminal.sendInput("\x1b]11;#ffffff\x07");
			assert.deepStrictEqual(await query, { r: 255, g: 255, b: 255 });
		} finally {
			tui.stop();
		}
	});

	it("keeps consuming a late OSC 11 reply after timeout", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		const component = new InputRecorder();
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1 });
			await wait(5);

			assert.strictEqual(await query, undefined);

			terminal.sendInput("\x1b]11;#ffffff\x07");

			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});
});

describe("parseOsc4PaletteColor", () => {
	it("parses the index and rgb color of a palette reply", () => {
		assert.deepStrictEqual(parseOsc4PaletteColor("\x1b]4;1;rgb:cccc/6666/6666\x1b\\"), {
			index: 1,
			rgb: { r: 204, g: 102, b: 102 },
		});
		assert.deepStrictEqual(parseOsc4PaletteColor("\x1b]4;12;#7aa6da\x07"), {
			index: 12,
			rgb: { r: 122, g: 166, b: 218 },
		});
		assert.strictEqual(parseOsc4PaletteColor("\x1b]11;#ffffff\x07"), undefined);
		assert.strictEqual(parseOsc4PaletteColor("\x1b]4;1;?\x07"), undefined);
	});
});

describe("TUI.queryTerminalPalette", () => {
	const reply = (index: number) => `\x1b]4;${index};rgb:${index.toString(16).padStart(2, "0")}/00/00\x07`;

	it("writes OSC 4 queries for colors 0-15 and resolves once every reply arrives", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		tui.start();
		try {
			const query = tui.queryTerminalPalette({ timeoutMs: 1000 });
			assert.ok(
				terminal.writes.some((write) => write.includes("\x1b]4;0;?\x07") && write.includes("\x1b]4;15;?\x07")),
			);

			for (let index = 15; index >= 0; index--) terminal.sendInput(reply(index));

			const palette = await query;
			assert.strictEqual(palette?.length, 16);
			assert.deepStrictEqual(palette?.[9], { r: 9, g: 0, b: 0 });
		} finally {
			tui.stop();
		}
	});

	it("resolves undefined when replies are missing, and still consumes late replies", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		const component = new InputRecorder();
		tui.addChild(component);
		tui.setFocus(component);
		tui.start();
		try {
			const query = tui.queryTerminalPalette({ timeoutMs: 1 });
			terminal.sendInput(reply(0));
			await wait(5);

			assert.strictEqual(await query, undefined);

			terminal.sendInput(reply(1));
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});
});

describe("TUI.queryTerminalForegroundColor", () => {
	it("writes an OSC 10 query and resolves with the foreground, independent of background queries", async () => {
		const terminal = new TestTerminal();
		const tui: TUI = new TuiMainScreen(terminal);
		tui.start();
		try {
			const background = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });
			const foreground = tui.queryTerminalForegroundColor({ timeoutMs: 1000 });
			assert.ok(terminal.writes.includes("\x1b]10;?\x07"));

			terminal.sendInput("\x1b]10;rgb:ffff/ffff/ffff\x1b\\");
			terminal.sendInput("\x1b]11;rgb:2828/2c2c/3434\x1b\\");

			assert.deepStrictEqual(await foreground, { r: 255, g: 255, b: 255 });
			assert.deepStrictEqual(await background, { r: 40, g: 44, b: 52 });
		} finally {
			tui.stop();
		}
	});
});
