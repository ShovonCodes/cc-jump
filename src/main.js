// The conductor: show the header, let the user drill through the project tree,
// pick a session, and hand off to Claude Code. All the edge-case checks live here.

import fs from "node:fs";
import readline from "node:readline";

import {
  renderHeader,
  drawMenuFooter,
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
import {
  isClaudeAvailable,
  isEditorAvailable,
  openDirectoryInEditor,
  resumeSession,
} from "./resume-session.js";

export async function main() {
  const version = readOwnVersion();

  // Claude Code has never been run — no data directory yet.
  if (!projectsRootExists()) {
    console.log(renderHeader(version));
    printEmptyState(
      "No Claude Code sessions found.",
      "Run `claude` in a project directory first, then come back."
    );
    return;
  }

  const projectDirectories = findProjectDirectories();

  // Data directory exists but every project inside it is empty.
  if (projectDirectories.length === 0) {
    console.log(renderHeader(version));
    printEmptyState(
      "No sessions yet.",
      "Start one by running `claude` in a project directory."
    );
    return;
  }

  const projectTree = buildProjectTree(projectDirectories);

  // Redraw in place before each menu (2J keeps scrollback; 3J would not).
  const redrawFrame = () => {
    clearScreen();
    console.log(renderHeader(version));
  };

  footerEnabled = true;

  // clack only treats Ctrl+C as quit; make Esc quit too.
  const stopEscapeToQuit = installEscapeToQuit();
  let chosen;
  try {
    chosen = await navigateToSession(projectTree, redrawFrame);
  } finally {
    footerEnabled = false;
    stopEscapeToQuit();
  }

  if (!chosen) {
    return; // Cancelled.
  }

  await resumeChosenSession(chosen.project, chosen.session, chosen.openInEditor);
}

// On only while menus are up, so stray redraws don't paint over the resume line.
let footerEnabled = false;

// Which menu is showing, so the footer hint and the `o` shortcut match the phase.
let footerHintVariant = "folder";

// Set true when `o` is pressed on the session picker — read back once the picker
// resolves to decide whether to also open the project in VS Code.
let editorRequested = false;

// Redraw the footer after clack paints (next tick), if menus are still up.
function scheduleFooterDraw() {
  setImmediate(() => {
    if (footerEnabled) {
      drawMenuFooter(footerHintVariant);
    }
  });
}

// Esc quits (clack 0.7 only acts on Ctrl+C, so feed it that for a clean teardown).
// In the session picker, `o` flags a VS Code open and then submits the highlighted
// row by feeding clack a synthetic Enter. Any other key reschedules the footer
// past clack's repaint.
function installEscapeToQuit() {
  if (!process.stdin.isTTY) {
    return () => {};
  }

  readline.emitKeypressEvents(process.stdin);
  const onKeypress = (character, key) => {
    if (key && key.name === "escape") {
      process.stdin.emit("keypress", "\x03", { name: "c", ctrl: true });
      return;
    }
    if (
      footerHintVariant === "session" &&
      key &&
      key.name === "o" &&
      !key.ctrl &&
      !key.meta
    ) {
      editorRequested = true;
      process.stdin.emit("keypress", "\r", { name: "return" });
      return;
    }
    scheduleFooterDraw();
  };

  process.stdin.on("keypress", onKeypress);
  return () => process.stdin.off("keypress", onKeypress);
}

// Clear the visible screen and home the cursor.
function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[2J\x1b[H");
  }
}

// Drills down and back up until a session is picked. Returns { project, session }
// or null. folderStack lets Back pop up a level.
async function navigateToSession(projectTree, redrawFrame) {
  let currentNode = collapseToPresentable(projectTree);
  const folderStack = [];

  while (true) {
    const childFolders = listChildFolders(currentNode);
    const hasOwnSessions = currentNode.project !== null;

    // Leaf project (sessions, no sub-folders): skip the menu, show sessions.
    if (hasOwnSessions && childFolders.length === 0) {
      const session = await pickSession(
        currentNode.project,
        folderStack.length > 0,
        folderStack.length,
        redrawFrame
      );
      const openInEditor = editorRequested;
      if (session === null) {
        return null;
      }
      if (session === SESSION_BACK) {
        currentNode = folderStack.pop();
        continue;
      }
      return { project: currentNode.project, session, openInEditor };
    }

    footerHintVariant = "folder";
    redrawFrame();
    scheduleFooterDraw();
    const choice = await promptUserToPickFromFolder(
      currentNode,
      childFolders,
      hasOwnSessions,
      folderStack.length > 0,
      folderStack.length
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
      const session = await pickSession(
        currentNode.project,
        true,
        folderStack.length,
        redrawFrame
      );
      const openInEditor = editorRequested;
      if (session === null) {
        return null;
      }
      if (session === SESSION_BACK) {
        continue; // Back to this folder's menu.
      }
      return { project: currentNode.project, session, openInEditor };
    }
  }
}

// Reads a project's sessions and shows the picker. Returns the session,
// SESSION_BACK, or null. Treats a vanished-since-listed project as a cancel.
async function pickSession(project, canGoBack, depth, redrawFrame) {
  const sessions = readSessionsInDirectory(project.dataDir);

  redrawFrame();
  if (sessions.length === 0) {
    printEmptyState(
      "That project has no readable sessions.",
      "Its session files may have been removed."
    );
    return null;
  }
  footerHintVariant = "session";
  editorRequested = false;
  scheduleFooterDraw();
  return promptUserToPickSession(sessions, canGoBack, depth);
}

// Launches Claude Code for the chosen session, after the last two safety checks.
// When openInEditor is set, also opens the project in VS Code (non-blocking).
async function resumeChosenSession(project, session, openInEditor) {
  // Directory gone — `claude --resume` is scoped to it, so don't launch elsewhere.
  if (!project.directoryStillExists) {
    printError(
      "Can't resume — the original project directory no longer exists:\n  " +
        shortenHomePath(project.originalPath)
    );
    return;
  }

  if (!isClaudeAvailable()) {
    printError(
      "claude CLI not found. Install it with:\n  npm install -g @anthropic-ai/claude-code"
    );
    return;
  }

  if (openInEditor) {
    openProjectInEditor(project.originalPath);
  }

  printResumingLine(project.originalPath);

  try {
    process.exitCode = await resumeSession(project.originalPath, session.id);
  } catch (launchError) {
    process.exitCode = 1;
    printError(describeLaunchFailure(launchError, project.originalPath));
  }
}

// A clear, actionable message for a failure to launch claude.
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

// Opens the project in VS Code, or notes why it couldn't (still resumes either way).
function openProjectInEditor(originalPath) {
  if (!isEditorAvailable()) {
    console.log(
      "\n" +
        faint("VS Code's `code` command isn't on your PATH — resuming in the terminal only.")
    );
    return;
  }
  openDirectoryInEditor(originalPath);
  console.log("\n" + amber(`↪ Opening ${shortenHomePath(originalPath)} in VS Code…`));
}

function printResumingLine(originalPath) {
  console.log("\n" + amber(`↪ Resuming session in ${shortenHomePath(originalPath)}…`));
}

function printEmptyState(message, hint) {
  console.log("\n" + secondary(message));
  console.log(faint(hint) + "\n");
}

// Errors go to stderr so they don't mix into piped output.
function printError(message) {
  console.error("\n" + error("✖ " + message) + "\n");
}

function readOwnVersion() {
  try {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl, "utf8"));
    return packageJson.version;
  } catch {
    return "0.0.0";
  }
}
