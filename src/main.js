// main.js — the conductor. It runs the whole flow end to end: show the header,
// list projects, let the user drill into one, pick a session, and hand off to
// Claude Code. Every "what could go wrong" check lives here so the individual
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
import { promptUserToPickDirectory } from "./prompt-directory.js";
import { promptUserToPickSession } from "./prompt-session.js";
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

  const chosenDirectory = await promptUserToPickDirectory(projectDirectories);
  if (!chosenDirectory) {
    return; // User cancelled — exit quietly.
  }

  const sessions = readSessionsInDirectory(chosenDirectory.dataDir);
  if (sessions.length === 0) {
    printEmptyState(
      "That project has no readable sessions.",
      "Its session files may have been removed."
    );
    return;
  }

  const chosenSession = await promptUserToPickSession(sessions);
  if (!chosenSession) {
    return; // User cancelled — exit quietly.
  }

  // Edge case: the session data still exists, but the directory it belongs to is
  // gone. `claude --resume` is scoped to that directory, so we can't run it from
  // anywhere else — fail clearly instead of launching into the wrong place.
  if (!chosenDirectory.directoryStillExists) {
    printError(
      "Can't resume — the original project directory no longer exists:\n  " +
        shortenHomePath(chosenDirectory.originalPath)
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

  printResumingLine(chosenDirectory.originalPath);

  const exitCode = await resumeSession(
    chosenDirectory.originalPath,
    chosenSession.id
  );
  process.exitCode = exitCode;
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
