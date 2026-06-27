// Filesystem layer — finds Claude Code's session data, works out each project's
// real directory, and parses sessions. All fs access lives here.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildSessionLabel } from "./build-labels.js";

// Claude Code keeps each project under ~/.claude/projects/<dir>/<session>.jsonl.
export function getProjectsRoot() {
  return path.join(os.homedir(), ".claude", "projects");
}

export function projectsRootExists() {
  return fs.existsSync(getProjectsRoot());
}

// The project list, skipping empty directories. Reads only enough to recover each
// real path; full parsing waits until a directory is picked.
export function findProjectDirectories() {
  const root = getProjectsRoot();
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const projectDirectories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dataDir = path.join(root, entry.name);
    const sessionFiles = listSessionFiles(dataDir);
    if (sessionFiles.length === 0) {
      continue;
    }

    const originalPath = resolveOriginalProjectPath(entry.name, sessionFiles);

    projectDirectories.push({
      dataDir: dataDir,
      originalPath: originalPath,
      directoryStillExists: fs.existsSync(originalPath),
      sessionCount: sessionFiles.length,
      mostRecentActivity: newestModifiedTime(sessionFiles),
    });
  }

  // Most recently used first — usually what you want next.
  projectDirectories.sort(
    (left, right) => right.mostRecentActivity - left.mostRecentActivity
  );

  return projectDirectories;
}

// Parses one directory's sessions into display data, newest-first (the expensive
// step, run only for the chosen directory).
export function readSessionsInDirectory(dataDir) {
  const sessionFiles = listSessionFiles(dataDir);
  const sessions = sessionFiles.map(readOneSession);

  sessions.sort((left, right) => right.lastActivity - left.lastActivity);

  return sessions;
}

// A malformed/empty file still yields a valid entry: null label, mtime fallback.
function readOneSession(sessionFilePath) {
  const sessionId = path.basename(sessionFilePath, ".jsonl");
  const records = parseSessionRecords(sessionFilePath);

  return {
    id: sessionId,
    label: buildSessionLabel(records),
    lastActivity: findLatestTimestamp(records) || fileModifiedTime(sessionFilePath),
  };
}

function listSessionFiles(dataDir) {
  let entries;
  try {
    entries = fs.readdirSync(dataDir);
  } catch {
    return [];
  }

  return entries
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => path.join(dataDir, name));
}

// The encoded dir name is lossy ("/" → "-" collides with dashes in real names),
// so we read the exact cwd from a transcript, decoding the name only as a fallback.
export function resolveOriginalProjectPath(encodedName, sessionFiles) {
  const newestFirst = [...sessionFiles].sort(
    (left, right) => fileModifiedTime(right) - fileModifiedTime(left)
  );

  for (const sessionFile of newestFirst) {
    const recordedCwd = readRecordedCwd(sessionFile);
    if (recordedCwd) {
      return recordedCwd;
    }
  }

  return decodeEncodedName(encodedName);
}

// First recorded cwd, or null.
function readRecordedCwd(sessionFilePath) {
  for (const record of iterateRecords(sessionFilePath)) {
    if (record.cwd) {
      return record.cwd;
    }
  }
  return null;
}

// Lossy fallback used only when no session recorded a cwd.
function decodeEncodedName(encodedName) {
  return encodedName.replace(/-/g, "/");
}

function parseSessionRecords(sessionFilePath) {
  return Array.from(iterateRecords(sessionFilePath));
}

// Reads the whole file, then yields one record per line, skipping blank/malformed
// lines so a single corrupt line doesn't take down the session.
function* iterateRecords(sessionFilePath) {
  let fileContents;
  try {
    fileContents = fs.readFileSync(sessionFilePath, "utf8");
  } catch {
    return;
  }

  for (const line of fileContents.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      yield JSON.parse(line);
    } catch {
      // Broken line — skip it.
    }
  }
}

function findLatestTimestamp(records) {
  let latest = null;
  for (const record of records) {
    if (!record.timestamp) {
      continue;
    }
    const when = new Date(record.timestamp);
    if (isNaN(when.getTime())) {
      continue;
    }
    if (latest === null || when > latest) {
      latest = when;
    }
  }
  return latest;
}

function newestModifiedTime(files) {
  let newestMilliseconds = 0;
  for (const file of files) {
    const modifiedMilliseconds = fileModifiedTime(file).getTime();
    if (modifiedMilliseconds > newestMilliseconds) {
      newestMilliseconds = modifiedMilliseconds;
    }
  }
  return newestMilliseconds;
}

// As a Date so it matches parsed timestamps; epoch fallback sorts to the bottom.
function fileModifiedTime(filePath) {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date(0);
  }
}
