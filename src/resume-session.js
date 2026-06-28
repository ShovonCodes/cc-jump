// The handoff: check the claude CLI exists, then launch `claude --resume` in the
// right directory and hand the terminal over.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CLAUDE_FILE_NAMES =
  process.platform === "win32"
    ? ["claude.cmd", "claude.exe", "claude.bat", "claude"]
    : ["claude"];

const EDITOR_FILE_NAMES =
  process.platform === "win32"
    ? ["code.cmd", "code.exe", "code.bat", "code"]
    : ["code"];

// Returns the full path to the first matching executable on PATH, or null.
// Cheaper than spawning each candidate just to see if it exists.
function findExecutableOnPath(candidateFileNames) {
  const directoriesOnPath = (process.env.PATH || "").split(path.delimiter);
  for (const directory of directoriesOnPath) {
    if (!directory) {
      continue;
    }
    for (const fileName of candidateFileNames) {
      const candidate = path.join(directory, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export function isClaudeAvailable() {
  return findExecutableOnPath(CLAUDE_FILE_NAMES) !== null;
}

export function isEditorAvailable() {
  return findExecutableOnPath(EDITOR_FILE_NAMES) !== null;
}

// Opens the directory in VS Code without taking over the terminal. Detached +
// unref'd so it outlives the handoff to claude; best-effort, so a launch error is
// swallowed (the caller already confirmed `code` is on PATH before calling).
export function openDirectoryInEditor(directoryPath) {
  const editorPath = findExecutableOnPath(EDITOR_FILE_NAMES);
  if (editorPath === null) {
    return false;
  }
  const child = spawn(editorPath, [directoryPath], {
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () => {});
  child.unref();
  return true;
}

// Launches `claude --resume <id>` from the project directory; resolves with its
// exit code, or rejects if it couldn't start.
//
// spawn + stdio:"inherit" (not exec) hands claude the live terminal. cwd goes via
// the option, not a "cd … && claude" string, so no shell is spawned to escape.
export function resumeSession(originalPath, sessionId) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["--resume", sessionId], {
      cwd: originalPath,
      stdio: "inherit",
    });

    // Never started — reject so the caller can explain (not a silent exit).
    child.on("error", (launchError) => {
      reject(launchError);
    });

    // Ran and finished; claude printed its own message, so pass the code through.
    child.on("exit", (exitCode) => {
      resolve(exitCode === null ? 0 : exitCode);
    });
  });
}
