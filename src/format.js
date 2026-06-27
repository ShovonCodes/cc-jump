// format.js — all color and text formatting helpers live here so the rest of
// the code can stay focused on logic. Keeping every ANSI escape code in one
// place means the whole look of the tool can be re-themed by editing one file.

import os from "node:os";

// We use 256-color ANSI codes rather than the basic 16 colors because they let
// us pick the *muted* teal/grey/gold tones the design calls for, instead of the
// harsh primary colors. Modern terminals all support 256 colors.
const COLOR_CODES = {
  // Muted teal — directory names and the primary accent.
  accent: "38;5;37",
  // Soft light grey — session labels and other primary reading text.
  secondary: "38;5;252",
  // Dark grey — session IDs, timestamps, decorative bits.
  dim: "38;5;244",
  // Even darker grey — the lightest, most de-emphasized notes.
  faint: "38;5;240",
  // Warm gold — the "resuming..." action line.
  amber: "38;5;214",
  // Soft red — error states only.
  error: "38;5;203",
};

// Color is disabled when output is not a terminal (e.g. piped to a file) or when
// the user has set NO_COLOR, which is the community standard for opting out.
// See https://no-color.org for why we honor this.
const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;

// Wraps text in a 256-color escape code, or returns it untouched when color is
// off. This is the single low-level primitive every other helper builds on.
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

// Replaces the user's home directory with "~" so paths read the way people
// actually think about them: "~/projects/app" instead of "/Users/me/projects/app".
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

// Pads a string on the right with spaces so columns line up. We measure the
// plain text length, which matters because color codes add invisible characters
// that would otherwise throw the alignment off — so callers must pad BEFORE
// coloring, not after.
export function padRight(text, width) {
  if (text.length >= width) {
    return text;
  }
  return text + " ".repeat(width - text.length);
}

// Turns a Date into a friendly relative string like "2 hours ago". We walk from
// the smallest unit up to the largest so the first matching bucket wins, which
// keeps the logic flat and easy to follow.
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

// Small helper so "1 minute ago" and "3 minutes ago" both read correctly.
function countLabel(count, unit) {
  const plural = count === 1 ? unit : unit + "s";
  return `${count} ${plural} ago`;
}

// The launch header: name, one-line description, and version, kept to three
// lines plus a separator as the design asks for. Returned as a string so the
// caller decides when to print it.
export function renderHeader(version) {
  const title = bold(accent("cc-jump"));
  const tagline = secondary("Browse and resume Claude Code sessions by project");
  const versionLine = dim(`v${version}`);
  return `\n${title}  ${versionLine}\n${tagline}\n${renderSeparator()}`;
}

// A single thin separator line. One deliberate line beats decorative borders
// everywhere, per the design direction.
export function renderSeparator() {
  return faint("─".repeat(52));
}

// The indent prepended to menu rows grows with how deep you've navigated, so the
// list visibly steps to the right each level down — making the parent/child
// hierarchy obvious at a glance. We cap the depth so very deep paths (like nested
// worktrees) can't push the list off the right edge of the screen.
const MENU_INDENT_UNIT = "  ";
const MAX_INDENT_LEVELS = 6;

export function menuIndent(level) {
  const cappedLevel = Math.min(Math.max(level, 0), MAX_INDENT_LEVELS);
  return MENU_INDENT_UNIT.repeat(cappedLevel);
}

// The controls line shown under the header during navigation. clack redraws the
// bottom of the screen on every keypress, so this sits in the (static) header
// region rather than as a true footer. Keys are dim, their labels fainter.
export function renderControlsHint() {
  return (
    dim("↑↓") + faint(" move   ") +
    dim("↵") + faint(" select   ") +
    dim("esc") + faint(" / ") + dim("ctrl+c") + faint(" quit")
  );
}
