// Color and text formatting helpers — every ANSI code lives here so the look can
// be re-themed in one place.

import os from "node:os";

// 256-color codes give the muted teal/grey/gold tones the basic 16 can't.
const COLOR_CODES = {
  accent: "38;5;37", // muted teal — folder names, primary accent
  secondary: "38;5;252", // soft grey — session labels
  dim: "38;5;244", // grey — ids, timestamps
  faint: "38;5;240", // darker grey — de-emphasized notes
  amber: "38;5;214", // gold — the "resuming" line
  error: "38;5;203", // red — errors only
};

// Off when output isn't a terminal or NO_COLOR is set (https://no-color.org).
const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(colorName, text) {
  if (!colorEnabled) {
    return text;
  }
  return `\x1b[${COLOR_CODES[colorName]}m${text}\x1b[39m`;
}

export function accent(text) {
  return paint("accent", text);
}

export function secondary(text) {
  return paint("secondary", text);
}

export function dim(text) {
  return paint("dim", text);
}

export function faint(text) {
  return paint("faint", text);
}

export function amber(text) {
  return paint("amber", text);
}

export function error(text) {
  return paint("error", text);
}

export function bold(text) {
  if (!colorEnabled) {
    return text;
  }
  return `\x1b[1m${text}\x1b[22m`;
}

export function shortenHomePath(absolutePath) {
  const home = os.homedir();
  if (absolutePath === home) {
    return "~";
  }
  if (absolutePath.startsWith(home + "/")) {
    return "~" + absolutePath.slice(home.length);
  }
  return absolutePath;
}

// Pads on the right to align columns. Measures plain length, so callers must pad
// BEFORE coloring — color codes are invisible characters that break alignment.
export function padRight(text, width) {
  if (text.length >= width) {
    return text;
  }
  return text + " ".repeat(width - text.length);
}

export function formatRelativeTime(date) {
  const secondsAgo = Math.round((Date.now() - date.getTime()) / 1000);

  if (secondsAgo < 45) {
    return "just now";
  }

  const minutesAgo = Math.round(secondsAgo / 60);
  if (minutesAgo < 60) {
    return countLabel(minutesAgo, "minute");
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return countLabel(hoursAgo, "hour");
  }

  const daysAgo = Math.round(hoursAgo / 24);
  if (daysAgo < 7) {
    return countLabel(daysAgo, "day");
  }

  const weeksAgo = Math.round(daysAgo / 7);
  if (weeksAgo < 5) {
    return countLabel(weeksAgo, "week");
  }

  const monthsAgo = Math.round(daysAgo / 30);
  if (monthsAgo < 12) {
    return countLabel(monthsAgo, "month");
  }

  const yearsAgo = Math.round(daysAgo / 365);
  return countLabel(yearsAgo, "year");
}

function countLabel(count, unit) {
  const plural = count === 1 ? unit : unit + "s";
  return `${count} ${plural} ago`;
}

export function renderHeader(version) {
  const title = bold(accent("cc-jump"));
  const tagline = secondary("Browse and resume Claude Code sessions by project");
  const versionLine = dim(`v${version}`);
  return `\n${title}  ${versionLine}\n${tagline}\n${renderSeparator()}`;
}

export function renderSeparator() {
  return faint("─".repeat(52));
}

// Indent grows with depth (capped) so the hierarchy shows without overflowing.
const MENU_INDENT_UNIT = "  ";
const MAX_INDENT_LEVELS = 6;

export function menuIndent(level) {
  const cappedLevel = Math.min(Math.max(level, 0), MAX_INDENT_LEVELS);
  return MENU_INDENT_UNIT.repeat(cappedLevel);
}

export function renderControlsHint() {
  return (
    dim("↑↓") + faint(" move   ") +
    dim("↵") + faint(" select   ") +
    dim("esc") + faint(" / ") + dim("ctrl+c") + faint(" quit")
  );
}

// Draws the hint one line below the cursor (where clack leaves it, at the menu's
// bottom), saving/restoring the cursor. clack erases downward on repaint, so main
// re-runs this after every keypress.
export function drawMenuFooter() {
  if (!process.stdout.isTTY) {
    return;
  }
  process.stdout.write("\x1b7\x1b[1B\r\x1b[2K  " + renderControlsHint() + "\x1b8");
}
