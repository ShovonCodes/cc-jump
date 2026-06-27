// prompt-directory.js — the folder navigation menu. It shows one level of the
// project tree at a time: the child folders, an optional "sessions in this
// folder" row when the current folder has its own sessions, and a Back row when
// there's somewhere to go back to. It reports what the user chose so the
// navigation loop in main can descend, open sessions, or step back up.

import { select, isCancel } from "@clack/prompts";

import {
  accent,
  dim,
  faint,
  secondary,
  padRight,
  shortenHomePath,
} from "./format.js";

// The kinds of choice this menu can return, so the caller can branch on intent
// rather than guessing from the shape of the value.
export const FOLDER_CHOICE = {
  BACK: "back",
  FOLDER: "folder",
  SESSIONS: "sessions",
};

// Widest a folder-name column is allowed to get before the count badges stop
// aligning to it, so one deep collapsed path can't shove every badge off-screen.
const MAX_NAME_COLUMN_WIDTH = 50;

// Shows the menu for one folder and returns the chosen action, or null if the
// user cancelled (Esc / Ctrl+C).
export async function promptUserToPickFromFolder(
  currentNode,
  childFolders,
  hasOwnSessions,
  canGoBack
) {
  const menuOptions = [];

  if (canGoBack) {
    menuOptions.push({ value: { kind: FOLDER_CHOICE.BACK }, label: dim("← Back") });
  }

  if (hasOwnSessions) {
    menuOptions.push(buildOwnSessionsOption(currentNode.project));
  }

  const nameColumnWidth = computeLongestNameWidth(childFolders);
  for (const folder of childFolders) {
    menuOptions.push({
      value: { kind: FOLDER_CHOICE.FOLDER, target: folder.target },
      label: buildFolderLabel(folder, nameColumnWidth),
    });
  }

  const choice = await select({
    message: buildBreadcrumb(currentNode),
    options: menuOptions,
    maxItems: 14,
  });

  if (isCancel(choice)) {
    return null;
  }
  return choice;
}

// The "▸ N sessions in this folder" row, shown when the current folder is itself
// a resumable project on top of holding sub-folders.
function buildOwnSessionsOption(project) {
  let label =
    accent("▸ ") + secondary(`${pluralizeSessions(project.sessionCount)} in this folder`);
  if (!project.directoryStillExists) {
    label += " " + faint("(directory no longer exists)");
  }
  return { value: { kind: FOLDER_CHOICE.SESSIONS }, label: label };
}

// One folder row: the (possibly collapsed) name in the accent color, a trailing
// slash to read as a folder, then an aligned, dimmed total-sessions badge.
function buildFolderLabel(folder, nameColumnWidth) {
  const folderName = folder.label + "/";

  // Pad the plain name BEFORE coloring so the badges line up — color codes are
  // invisible characters that would otherwise throw the alignment off.
  const alignedName = accent(padRight(folderName, nameColumnWidth));
  let label = `${alignedName}  ${dim(`(${pluralizeSessions(folder.totalSessions)})`)}`;

  // A collapsed target that is itself a resumable project whose directory is gone.
  if (isMissingLeafProject(folder.target)) {
    label += " " + faint("(directory no longer exists)");
  }
  return label;
}

function isMissingLeafProject(targetNode) {
  return (
    targetNode.project !== null &&
    !targetNode.project.directoryStillExists &&
    targetNode.children.size === 0
  );
}

// "1 session" vs "3 sessions".
function pluralizeSessions(count) {
  const noun = count === 1 ? "session" : "sessions";
  return `${count} ${noun}`;
}

function computeLongestNameWidth(childFolders) {
  let longest = 0;
  for (const folder of childFolders) {
    const width = (folder.label + "/").length;
    if (width > longest) {
      longest = width;
    }
  }
  return Math.min(longest, MAX_NAME_COLUMN_WIDTH);
}

// The location line, e.g. "~ › projects › cuttingroom" — ancestors dimmed, the
// current folder in the accent color so you always know where you are.
function buildBreadcrumb(node) {
  const segments = shortenHomePath(node.fullPath)
    .split("/")
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return accent("/");
  }

  const currentSegment = segments.pop();
  const ancestors = segments.length ? dim(segments.join(" › ") + " › ") : "";
  return ancestors + accent(currentSegment);
}
