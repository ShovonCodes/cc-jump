// Tests for the claude-on-PATH check. A false negative blocks every resume even
// when claude is installed; a false positive sends the user into a confusing
// launch failure — so this near-pure function is worth pinning down.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isClaudeAvailable, isEditorAvailable } from "../src/resume-session.js";

// These tests overwrite process.env.PATH, so each one restores it afterwards.
function withPath(temporaryPath, body) {
  const originalPath = process.env.PATH;
  process.env.PATH = temporaryPath;
  try {
    body();
  } finally {
    process.env.PATH = originalPath;
  }
}

test("finds claude when a matching executable is on PATH", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-jump-path-"));
  try {
    fs.writeFileSync(path.join(dir, "claude"), "");
    withPath(dir, () => {
      assert.equal(isClaudeAvailable(), true);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reports not found when no PATH directory contains claude", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-jump-path-"));
  try {
    withPath(dir, () => {
      assert.equal(isClaudeAvailable(), false);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("skips empty PATH segments instead of false-positiving on the cwd", () => {
  // A PATH of just empty segments must not resolve "claude" against the current
  // working directory and report a false hit.
  withPath(path.delimiter + path.delimiter, () => {
    assert.equal(isClaudeAvailable(), false);
  });
});

test("finds the editor when `code` is on PATH, misses when it isn't", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-jump-path-"));
  try {
    withPath(dir, () => {
      assert.equal(isEditorAvailable(), false);
    });
    fs.writeFileSync(path.join(dir, "code"), "");
    withPath(dir, () => {
      assert.equal(isEditorAvailable(), true);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
