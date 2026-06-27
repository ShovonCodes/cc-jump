// Tests for the project tree: how the flat project list becomes a navigable
// hierarchy, how single-child chains collapse, and how folders aggregate counts.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectTree,
  collapseToPresentable,
  listChildFolders,
} from "../src/build-tree.js";

// A stand-in for what findProjectDirectories() produces, with only the fields
// the tree actually reads.
function fakeProject(originalPath, sessionCount, mostRecentActivity) {
  return {
    originalPath: originalPath,
    dataDir: "/data" + originalPath,
    directoryStillExists: true,
    sessionCount: sessionCount,
    mostRecentActivity: mostRecentActivity,
  };
}

test("collapses single-child chains down to the first real branch", () => {
  const tree = buildProjectTree([
    fakeProject("/Users/me/projects/personal/cc-jump", 3, 300),
    fakeProject("/Users/me/projects/personal/chor", 2, 200),
    fakeProject("/Users/me/projects/cuttingroom/vimond", 19, 100),
  ]);

  // /Users, /Users/me and /Users/me/projects each have a single child, so we
  // skip straight to the first folder that offers a choice.
  const start = collapseToPresentable(tree);
  assert.equal(start.fullPath, "/Users/me/projects");
  assert.equal(start.totalSessions, 24);
});

test("lists child folders most-recently-active first with aggregate counts", () => {
  const tree = buildProjectTree([
    fakeProject("/Users/me/projects/personal/cc-jump", 3, 300),
    fakeProject("/Users/me/projects/personal/chor", 2, 200),
    fakeProject("/Users/me/projects/cuttingroom/vimond", 19, 100),
  ]);

  const folders = listChildFolders(collapseToPresentable(tree));

  // personal's newest activity (300) beats cuttingroom's (100), so it sorts
  // first. cuttingroom has only one project, so it collapses to a single row.
  assert.deepEqual(
    folders.map((folder) => folder.label),
    ["personal", "cuttingroom/vimond"]
  );
  // personal aggregates its two projects: 3 + 2 = 5 sessions.
  assert.equal(folders[0].totalSessions, 5);
  assert.equal(folders[1].totalSessions, 19);
});

test("keeps a folder that has both its own sessions and sub-folders", () => {
  const tree = buildProjectTree([
    fakeProject("/Users/me/repo", 5, 500),
    fakeProject("/Users/me/repo/.claude/worktrees/wt1", 1, 400),
  ]);

  // repo has its own sessions, so collapsing must stop there rather than diving
  // into its single child and hiding those sessions.
  const start = collapseToPresentable(tree);
  assert.equal(start.fullPath, "/Users/me/repo");
  assert.equal(start.project.sessionCount, 5);

  // Its one sub-project collapses to a single readable row.
  const folders = listChildFolders(start);
  assert.equal(folders.length, 1);
  assert.equal(folders[0].label, ".claude/worktrees/wt1");
  assert.equal(folders[0].target.project.originalPath, "/Users/me/repo/.claude/worktrees/wt1");
});

test("a lone project collapses all the way to a sessions-only leaf", () => {
  const tree = buildProjectTree([fakeProject("/a/b/c", 2, 1)]);

  const start = collapseToPresentable(tree);
  assert.equal(start.fullPath, "/a/b/c");
  assert.equal(start.project.sessionCount, 2);
  assert.equal(listChildFolders(start).length, 0); // no sub-folders → goes straight to sessions
});
