// resume-session.js — the handoff. Once a session is chosen, this module checks
// that the claude CLI exists and then launches `claude --resume` in the right
// directory, handing this terminal over to Claude Code.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Checks whether the `claude` command is reachable on the user's PATH. We look
// for the executable ourselves rather than running it, because actually invoking
// `claude --version` just to test for its presence is slower and noisier. We
// check the Windows wrapper extensions too so this works cross-platform.
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

// Launches `claude --resume <sessionId>` from the project's original directory
// and resolves with its exit code once Claude Code finishes.
//
// Two deliberate choices here:
//   - We use spawn with stdio:"inherit", not exec. Claude Code is a fully
//     interactive program, and inheriting the terminal hands it our stdin/stdout
//     directly. exec would buffer the output and break the interactive UI.
//   - We pass the directory via the `cwd` option instead of building a
//     "cd <dir> && claude ..." shell string. That avoids spawning a shell at all,
//     so there is nothing to quote or escape and no chance of shell injection
//     from an odd directory name.
export function resumeSession(originalPath, sessionId) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["--resume", sessionId], {
      cwd: originalPath,
      stdio: "inherit",
    });

    // The "error" event means claude never even started — it vanished after our
    // PATH check, the directory became unreadable, exec was denied, etc. We
    // reject with the real error so the caller can explain what went wrong.
    // Resolving a bare exit code here would leave the user staring at a silent
    // exit right after the "Resuming…" line.
    child.on("error", (launchError) => {
      reject(launchError);
    });

    // The "exit" event means claude actually ran and then finished. A non-zero
    // code here came from claude itself, which has already printed its own
    // message to the inherited terminal, so we just pass the code through.
    child.on("exit", (exitCode) => {
      resolve(exitCode === null ? 0 : exitCode);
    });
  });
}
