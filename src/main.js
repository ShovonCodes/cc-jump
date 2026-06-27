// main.js — the conductor. It runs the whole flow end to end: show the header,
// let the user drill down through the project tree, pick a session, and hand off
// to Claude Code. Every "what could go wrong" check lives here so the individual
// steps can stay simple and assume they're given good data.

import fs from "node:fs";

import {
  renderHeader,
  amber,
  error,
  secondary,
  faint,
  shortenHomePath,
} from "./format.js";
import {
  projectsRootExists,
  findProjectDirectories,
  readSessionsInDirectory,
} from "./read-sessions.js";
import {
  buildProjectTree,
  collapseToPresentable,
  listChildFolders,
} from "./build-tree.js";
import {
  promptUserToPickFromFolder,
  FOLDER_CHOICE,
} from "./prompt-directory.js";
import { promptUserToPickSession, SESSION_BACK } from "./prompt-session.js";
import { isClaudeAvailable, resumeSession } from "./resume-session.js";

export async function main() {
  console.log(renderHeader(readOwnVersion()));

  // Edge case: Claude Code has never been run, so there's no data directory yet.
  if (!projectsRootExists()) {
    printEmptyState(
      "No Claude Code sessions found.",
      "Run `claude` in a project directory first, then come back."
    );
    return;
  }

  const projectDirectories = findProjectDirectories();

  // Edge case: the data directory exists but every project inside it is empty.
  if (projectDirectories.length === 0) {
    printEmptyState(
      "No sessions yet.",
      "Start one by running `claude` in a project directory."
    );
    return;
  }

  const projectTree = buildProjectTree(projectDirectories);
  const chosen = await navigateToSession(projectTree);
  if (!chosen) {
    return; // User cancelled — exit quietly.
  }

  await resumeChosenSession(chosen.project, chosen.session);
}

// Walks the user down through the folder tree and back up again until they pick
// a session. Returns { project, session }, or null if they cancelled.
//
// `stack` holds the folders we descended through so "Back" can pop up one level.
// We start at the first folder worth showing — single-child chains near the root
// (like /Users/me) are skipped so the first menu offers a real choice.
async function navigateToSession(projectTree) {
  let currentNode = collapseToPresentable(projectTree);
  const folderStack = [];

  while (true) {
    const childFolders = listChildFolders(currentNode);
    const hasOwnSessions = currentNode.project !== null;

    // A folder with sessions and no sub-folders is a leaf project: skip the
    // folder menu entirely and go straight to its sessions.
    if (hasOwnSessions && childFolders.length === 0) {
      const session = await pickSession(currentNode.project, folderStack.length > 0);
      if (session === null) {
        return null;
      }
      if (session === SESSION_BACK) {
        currentNode = folderStack.pop();
        continue;
      }
      return { project: currentNode.project, session: session };
    }

    const choice = await promptUserToPickFromFolder(
      currentNode,
      childFolders,
      hasOwnSessions,
      folderStack.length > 0
    );

    if (choice === null) {
      return null;
    }
    if (choice.kind === FOLDER_CHOICE.BACK) {
      currentNode = folderStack.pop();
      continue;
    }
    if (choice.kind === FOLDER_CHOICE.FOLDER) {
      folderStack.push(currentNode);
      currentNode = choice.target;
      continue;
    }
    if (choice.kind === FOLDER_CHOICE.SESSIONS) {
      const session = await pickSession(currentNode.project, true);
      if (session === null) {
        return null;
      }
      if (session === SESSION_BACK) {
        continue; // Back to this same folder's menu.
      }
      return { project: currentNode.project, session: session };
    }
  }
}

// Reads a project's sessions and shows the session picker. Returns the chosen
// session, SESSION_BACK, or null (cancel). If the sessions vanished since we
// listed them, says so and treats it as a cancel.
async function pickSession(project, canGoBack) {
  const sessions = readSessionsInDirectory(project.dataDir);
  if (sessions.length === 0) {
    printEmptyState(
      "That project has no readable sessions.",
      "Its session files may have been removed."
    );
    return null;
  }
  return promptUserToPickSession(sessions, canGoBack);
}

// Launches Claude Code for the chosen session, after the last two safety checks.
async function resumeChosenSession(project, session) {
  // Edge case: the session data still exists, but the directory it belongs to is
  // gone. `claude --resume` is scoped to that directory, so we can't run it from
  // anywhere else — fail clearly instead of launching into the wrong place.
  if (!project.directoryStillExists) {
    printError(
      "Can't resume — the original project directory no longer exists:\n  " +
        shortenHomePath(project.originalPath)
    );
    return;
  }

  // Edge case: the claude CLI isn't installed or isn't on PATH.
  if (!isClaudeAvailable()) {
    printError(
      "claude CLI not found. Install it with:\n  npm install -g @anthropic-ai/claude-code"
    );
    return;
  }

  printResumingLine(project.originalPath);

  try {
    process.exitCode = await resumeSession(project.originalPath, session.id);
  } catch (launchError) {
    // claude failed to even start. Explain why, so the user isn't left with a
    // bare "Resuming…" line and a silent exit.
    process.exitCode = 1;
    printError(describeLaunchFailure(launchError, project.originalPath));
  }
}

// Turns a failure to launch claude into a clear, actionable message based on the
// underlying error code.
function describeLaunchFailure(launchError, originalPath) {
  const code = launchError && launchError.code;

  if (code === "ENOENT") {
    return (
      "Couldn't launch claude — it may have been uninstalled, or the project " +
      "directory was removed:\n  " +
      shortenHomePath(originalPath) +
      "\nReinstall it with: npm install -g @anthropic-ai/claude-code"
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return "Couldn't launch claude — permission denied. Check that it is executable.";
  }

  const reason =
    launchError && launchError.message ? launchError.message : String(launchError);
  return `Couldn't launch claude: ${reason}`;
}

// The amber confirmation line shown just before Claude Code takes over.
function printResumingLine(originalPath) {
  console.log("\n" + amber(`↪ Resuming session in ${shortenHomePath(originalPath)}…`));
}

// A friendly two-line empty state: what happened, then a hint about what to do.
function printEmptyState(message, hint) {
  console.log("\n" + secondary(message));
  console.log(faint(hint) + "\n");
}

// A clear, red error message. Goes to stderr so it doesn't get mixed into normal
// output if someone pipes this tool somewhere.
function printError(message) {
  console.error("\n" + error("✖ " + message) + "\n");
}

// Reads this package's own version out of package.json so the header always shows
// the real installed version. Falls back gracefully if it can't be read.
function readOwnVersion() {
  try {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl, "utf8"));
    return packageJson.version;
  } catch {
    return "0.0.0";
  }
}
