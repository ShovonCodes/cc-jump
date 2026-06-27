// prompt-directory.js — the first picker: choose which project to look inside.
// It only knows how to turn a list of project directories into a nice-looking
// menu and report back which one the user chose.

import { select, isCancel } from "@clack/prompts";

import { accent, dim, faint, padRight, shortenHomePath } from "./format.js";

// Shows the directory menu and returns the chosen project directory object, or
// null if the user cancelled (Esc / Ctrl+C). We return null rather than throwing
// so the caller can exit cleanly without a stack trace.
export async function promptUserToPickDirectory(projectDirectories) {
  const longestPathWidth = computeLongestPathWidth(projectDirectories);

  const menuOptions = projectDirectories.map((directory) =>
    buildDirectoryOption(directory, longestPathWidth)
  );

  const choice = await select({
    message: "Pick a project",
    options: menuOptions,
    maxItems: 12,
  });

  if (isCancel(choice)) {
    return null;
  }
  return choice;
}

// Builds one menu row: the project path in the accent color, then an aligned,
// dimmed session-count badge, plus a faint note if the folder is gone from disk.
function buildDirectoryOption(directory, pathColumnWidth) {
  const shortPath = shortenHomePath(directory.originalPath);

  // Pad the plain path BEFORE coloring it so the count badges line up — color
  // codes are invisible characters that would otherwise break the alignment.
  const alignedPath = accent(padRight(shortPath, pathColumnWidth));
  const countBadge = dim(`(${pluralizeSessions(directory.sessionCount)})`);

  let label = `${alignedPath}  ${countBadge}`;
  if (!directory.directoryStillExists) {
    label += ` ${faint("(directory no longer exists)")}`;
  }

  return { value: directory, label: label };
}

// "1 session" vs "3 sessions".
function pluralizeSessions(count) {
  const noun = count === 1 ? "session" : "sessions";
  return `${count} ${noun}`;
}

// The width to pad every path to, so the count badges form a clean column. We
// cap it so one very long path can't push every badge far off to the right.
function computeLongestPathWidth(projectDirectories) {
  const MAX_PATH_COLUMN_WIDTH = 60;
  let longest = 0;
  for (const directory of projectDirectories) {
    const width = shortenHomePath(directory.originalPath).length;
    if (width > longest) {
      longest = width;
    }
  }
  return Math.min(longest, MAX_PATH_COLUMN_WIDTH);
}
