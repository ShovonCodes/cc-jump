// The handoff: check the claude CLI exists, then launch `claude --resume` in the
// right directory and hand the terminal over.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Looks for the claude executable on PATH directly — cheaper and quieter than
// running it. Checks Windows wrapper extensions too.
export function isClaudeAvailable() {
  const directoriesOnPath = (process.env.PATH || "").split(path.delimiter);
  const candidateFileNames =
    process.platform === "win32"
      ? ["claude.cmd", "claude.exe", "claude.bat", "claude"]
      : ["claude"];

  for (const directory of directoriesOnPath) {
    if (!directory) {
      continue;
    }
    for (const fileName of candidateFileNames) {
      if (fs.existsSync(path.join(directory, fileName))) {
        return true;
      }
    }
  }
  return false;
}

// Launches `claude --resume <id>` from the project directory; resolves with its
// exit code, or rejects if it couldn't start.
//
// spawn (not exec) with stdio:"inherit" hands claude the live terminal — exec
// would buffer output and break the interactive UI. The directory goes through
// the cwd option rather than a "cd … && claude" shell string, so no shell is
// spawned and there's nothing to escape.
export function resumeSession(originalPath, sessionId) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["--resume", sessionId], {
      cwd: originalPath,
      stdio: "inherit",
    });

    // "error" = claude never started. Reject so the caller can explain, rather
    // than leaving a silent exit after the "Resuming…" line.
    child.on("error", (launchError) => {
      reject(launchError);
    });

    // "exit" = claude ran and finished; it printed its own message, so pass the
    // code through.
    child.on("exit", (exitCode) => {
      resolve(exitCode === null ? 0 : exitCode);
    });
  });
}
