/**
 * The Pi logo, drawn with terminal half blocks.
 *
 * The logo is a 4x4 pixel grid (brand kit pi-logo SVG, 140px units):
 *
 *   R R R .    R = coral  #F09082
 *   B . R .    B = blue   #4D9ABF
 *   B B . Y    Y = yellow #F1BE58
 *   B . . Y
 *
 * Each terminal cell holds two stacked pixels: "▀" paints the top pixel with the
 * foreground and the bottom pixel with the background, "█" paints both. Terminal
 * cells are about twice as tall as wide, so this gives square pixels in 4x2 cells.
 * The brand colors are fixed; they do not follow the theme.
 */
const CORAL = "\x1b[38;2;240;144;130m";
const BLUE = "\x1b[38;2;77;154;191m";
const BLUE_BACKGROUND = "\x1b[48;2;77;154;191m";
const YELLOW = "\x1b[38;2;241;190;88m";
const RESET = "\x1b[39;49m";

export const PI_LOGO_LINES: readonly string[] = [
	`${CORAL}${BLUE_BACKGROUND}▀${RESET}${CORAL}▀█${RESET} `,
	`${BLUE}█▀${RESET} ${YELLOW}█${RESET}`,
];

/** Visible width of each logo line, in terminal columns. */
export const PI_LOGO_WIDTH = 4;
