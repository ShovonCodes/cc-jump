// read-sessions.js — everything that touches the filesystem. It finds Claude
// Code's session data, works out the real project directory each group of
// sessions belongs to, and parses individual sessions. Keeping all the fs access
// here means the rest of the app deals in plain data, not file paths.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildSessionLabel } from "./build-labels.js";

// Claude Code stores every session under ~/.claude/projects/. Each subdirectory
// is one project, and each .jsonl file inside it is one session transcript.
export function getProjectsRoot() {
  return path.join(os.homedir(), ".claude", "projects");
}

export function projectsRootExists() {
  return fs.existsSync(getProjectsRoot());
}

// Builds the list shown in the directory picker. Each entry knows its real
// project path, how many sessions it holds, and when it was last touched. We
// skip any project directory that has no sessions so the picker stays clean.
//
// To keep listing reasonably quick, this does NOT fully parse every transcript.
// For each directory it scans session files only until one reveals a recorded
// cwd — usually just the newest file, but it will read further if earlier files
// record none. (Each file it does touch is read whole into memory; see
// iterateRecords.) The heavy per-session parsing happens later, only for the one
// directory the user actually picks.
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
      continue; // No sessions here — don't show an empty project.
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

  // Most recently used projects first — that's almost always what you want next.
  projectDirectories.sort(
    (left, right) => right.mostRecentActivity - left.mostRecentActivity
  );

  return projectDirectories;
}

// Parses every session in one project directory into display-ready data. This is
// the expensive step, so we only call it for the directory the user selected.
// Sessions come back newest-first.
export function readSessionsInDirectory(dataDir) {
  const sessionFiles = listSessionFiles(dataDir);
  const sessions = sessionFiles.map(readOneSession);

  sessions.sort((left, right) => right.lastActivity - left.lastActivity);

  return sessions;
}

// Reads and parses a single session file into { id, label, lastActivity }.
// A malformed or empty file still produces a valid entry: the label is null
// (the UI shows a fallback) and the time falls back to the file's mtime.
function readOneSession(sessionFilePath) {
  const sessionId = path.basename(sessionFilePath, ".jsonl");
  const records = parseSessionRecords(sessionFilePath);

  return {
    id: sessionId,
    label: buildSessionLabel(records),
    lastActivity: findLatestTimestamp(records) || fileModifiedTime(sessionFilePath),
  };
}

// Returns the absolute paths of every .jsonl session file directly inside a
// project directory.
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

// Works out the real working directory a project's sessions were started in.
//
// We can't trust the encoded directory name alone: Claude Code encodes a path
// like /Users/me/cc-jump by turning every "/" into "-", which is ambiguous
// because real folder names ("cc-jump") also contain "-". So we read the cwd
// that each session records inside its transcript — that value is exact. Only if
// no session reveals a cwd (e.g. every file is unreadable) do we fall back to
// decoding the name and accept its ambiguity.
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

// Scans a session's records for the first "cwd" it recorded and returns it,
// stopping at the first match. Returns null if the file is unreadable or never
// mentions a cwd. (The file is read whole into memory first — see
// iterateRecords — so only the JSON parsing of later lines is skipped.)
function readRecordedCwd(sessionFilePath) {
  for (const record of iterateRecords(sessionFilePath)) {
    if (record.cwd) {
      return record.cwd;
    }
  }
  return null;
}

// The fallback decoder, used only when no session recorded its cwd. Claude Code
// replaces "/" with "-", so we reverse that. This is lossy for paths whose own
// folder names contain dashes, which is exactly why we prefer the recorded cwd.
function decodeEncodedName(encodedName) {
  return encodedName.replace(/-/g, "/");
}

// Parses an entire session file into an array of records, skipping any lines that
// fail to parse. Returns an empty array if the file can't be read at all.
function parseSessionRecords(sessionFilePath) {
  return Array.from(iterateRecords(sessionFilePath));
}

// Shared reader for a .jsonl file: it reads the whole file into memory, then
// yields one parsed record per line, lazily, skipping blank or malformed lines
// so a single corrupt line never takes down the whole session.
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
      // A broken line (partial write, corruption) — skip it and keep going.
    }
  }
}

// Finds the most recent timestamp recorded anywhere in a session, as a Date, or
// null if no record carried a usable timestamp.
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

// The newest mtime among a set of files, as a millisecond number for easy
// sorting.
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

// A single file's last-modified time. Returned as a Date so it slots straight
// into the same fields as parsed timestamps. Falls back to the epoch if the file
// can't be stat'd, which sorts it to the bottom.
function fileModifiedTime(filePath) {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date(0);
  }
}
