// The folder navigation menu: one level of the tree at a time — child folders,
// an optional "sessions in this folder" row, and a Back row. Reports the choice
// back to the navigation loop.

import { select, isCancel } from "@clack/prompts";

import {
  accent,
  dim,
  faint,
  secondary,
  padRight,
  shortenHomePath,
  menuIndent,
} from "./format.js";

export const FOLDER_CHOICE = {
  BACK: "back",
  FOLDER: "folder",
  SESSIONS: "sessions",
};

// Cap so one deep collapsed path can't push every badge off-screen.
const MAX_NAME_COLUMN_WIDTH = 50;

// Shows one folder's menu; returns the chosen action or null if cancelled.
// `depth` is how many folders deep we are, used to indent the list.
export async function promptUserToPickFromFolder(
  currentNode,
  childFolders,
  hasOwnSessions,
  canGoBack,
  depth
) {
  const indent = menuIndent(depth + 1);
  const menuOptions = [];

  if (canGoBack) {
    // Back goes up a level, so it isn't indented with the children below it.
    menuOptions.push({
      value: { kind: FOLDER_CHOICE.BACK },
      label: dim("← Back"),
    });
  }

  if (hasOwnSessions) {
    menuOptions.push(buildOwnSessionsOption(currentNode.project, indent));
  }

  const nameColumnWidth = computeLongestNameWidth(childFolders);
  for (const folder of childFolders) {
    menuOptions.push({
      value: { kind: FOLDER_CHOICE.FOLDER, target: folder.target },
      label: buildFolderLabel(folder, nameColumnWidth, indent),
    });
  }

  const choice = await select({
    message: buildBreadcrumb(currentNode),
    options: menuOptions,
    // Start on the first item you can go into, not Back — going deeper is common.
    initialValue: firstForwardValue(menuOptions, canGoBack),
    maxItems: 14,
  });

  if (isCancel(choice)) {
    return null;
  }
  return choice;
}

// First non-Back row's value, so the cursor doesn't start on Back.
function firstForwardValue(menuOptions, canGoBack) {
  const firstForwardIndex = canGoBack ? 1 : 0;
  const firstForward = menuOptions[firstForwardIndex];
  return firstForward ? firstForward.value : undefined;
}

// The "▸ N sessions in this folder" row, for a folder that is itself a project.
function buildOwnSessionsOption(project, indent) {
  let label =
    indent +
    accent("▸ ") +
    secondary(`${pluralizeSessions(project.sessionCount)} in this folder`);
  if (!project.directoryStillExists) {
    label += " " + faint("(directory no longer exists)");
  }
  return { value: { kind: FOLDER_CHOICE.SESSIONS }, label: label };
}

function buildFolderLabel(folder, nameColumnWidth, indent) {
  const folderName = folder.label + "/";

  // Pad before coloring so badges align (color codes are invisible characters).
  const alignedName = accent(padRight(folderName, nameColumnWidth));
  let label = `${indent}${alignedName}  ${dim(`(${pluralizeSessions(folder.totalSessions)})`)}`;

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

// The location line, e.g. "~ › projects › personal" — ancestors dimmed, current
// folder in the accent color.
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
