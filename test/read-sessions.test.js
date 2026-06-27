// Tests for reading a project directory's sessions. These use a throwaway temp
// directory of fake .jsonl files so they exercise the real parsing, sorting, and
// malformed-file handling without touching the user's actual Claude Code data.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readSessionsInDirectory } from "../src/read-sessions.js";

function makeTempProjectDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cc-jump-test-"));
}

function writeSessionFile(dir, sessionId, records) {
  const contents = records.map((record) => JSON.stringify(record)).join("\n");
  fs.writeFileSync(path.join(dir, sessionId + ".jsonl"), contents);
}

test("reads sessions and orders them newest activity first", () => {
  const dir = makeTempProjectDir();
  try {
    writeSessionFile(dir, "older", [
      { type: "ai-title", aiTitle: "Older session" },
      { type: "user", timestamp: "2026-01-01T00:00:00.000Z", message: { content: "hi" } },
    ]);
    writeSessionFile(dir, "newer", [
      { type: "ai-title", aiTitle: "Newer session" },
      { type: "user", timestamp: "2026-02-01T00:00:00.000Z", message: { content: "hi" } },
    ]);

    const sessions = readSessionsInDirectory(dir);

    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].id, "newer");
    assert.equal(sessions[0].label, "Newer session");
    assert.equal(sessions[1].id, "older");
    assert.equal(sessions[1].label, "Older session");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("handles empty and malformed session files without crashing", () => {
  const dir = makeTempProjectDir();
  try {
    fs.writeFileSync(path.join(dir, "empty.jsonl"), "");
    fs.writeFileSync(path.join(dir, "broken.jsonl"), "not json at all\n{partial");

    const sessions = readSessionsInDirectory(dir);

    assert.equal(sessions.length, 2);
    for (const session of sessions) {
      assert.equal(session.label, null); // UI shows a fallback for these
      assert.ok(session.lastActivity instanceof Date); // mtime fallback kicked in
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
