// Tests for the project tree: how the flat project list becomes a navigable
// hierarchy, how single-child chains collapse, and how folders aggregate counts.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectTree,
  collapseToPresentable,
  listChildFolders,
  splitIntoSegments,
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
    fakeProject("/Users/me/projects/work/api", 19, 100),
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
    fakeProject("/Users/me/projects/work/api", 19, 100),
  ]);

  const folders = listChildFolders(collapseToPresentable(tree));

  // personal's newest activity (300) beats work's (100), so it sorts
  // first. work has only one project, so it collapses to a single row.
  assert.deepEqual(
    folders.map((folder) => folder.label),
    ["personal", "work/api"]
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

// --- OS-agnostic path splitting ---------------------------------------------
// Paths come from the transcript's recorded cwd, so they use the separators of
// the OS the session ran on. These pass the platform explicitly so each case is
// deterministic no matter which OS runs the tests.

test("splits POSIX paths on / and leaves backslashes as literal name characters", () => {
  assert.deepEqual(splitIntoSegments("/Users/me/projects/foo", "linux"), [
    "Users",
    "me",
    "projects",
    "foo",
  ]);
  assert.deepEqual(splitIntoSegments("/Users/me/projects/foo", "darwin"), [
    "Users",
    "me",
    "projects",
    "foo",
  ]);
  // "\" is a valid filename character on POSIX, so it must NOT be a separator.
  assert.deepEqual(splitIntoSegments("/srv/od\\nd/app", "linux"), [
    "srv",
    "od\\nd",
    "app",
  ]);
});

test("splits Windows paths on both \\ and /, including mixed and UNC paths", () => {
  assert.deepEqual(
    splitIntoSegments("d:\\Workspace\\personal\\novel\\rnos", "win32"),
    ["d:", "Workspace", "personal", "novel", "rnos"]
  );
  // Windows tolerates forward slashes too, even mixed with backslashes.
  assert.deepEqual(
    splitIntoSegments("D:\\Workspace/personal\\foo", "win32"),
    ["D:", "Workspace", "personal", "foo"]
  );
  assert.deepEqual(splitIntoSegments("D:/Workspace/foo", "win32"), [
    "D:",
    "Workspace",
    "foo",
  ]);
  // UNC share: leading "\\" yields empties, which are filtered out.
  assert.deepEqual(splitIntoSegments("\\\\server\\share\\proj", "win32"), [
    "server",
    "share",
    "proj",
  ]);
});

test("drops empty segments from trailing and repeated separators", () => {
  assert.deepEqual(splitIntoSegments("/a//b/", "linux"), ["a", "b"]);
  assert.deepEqual(splitIntoSegments("d:\\a\\\\b\\", "win32"), ["d:", "a", "b"]);
});

test("groups Windows projects into a real hierarchy instead of a flat path list", () => {
  // The exact case a Windows user hit: backslash cwds were treated as one
  // segment each, so every project sat at the root as a full path. They should
  // group under their shared parents instead.
  const tree = buildProjectTree(
    [
      fakeProject("d:\\Workspace\\personal\\novel\\rnos", 8, 400),
      fakeProject("d:\\Workspace\\everviz\\everviz", 8, 300),
      fakeProject("d:\\Workspace\\personal\\app-dev\\expense-tracker", 1, 200),
      fakeProject("d:\\Workspace\\personal\\games\\Genshin Runner", 2, 100),
    ],
    "win32"
  );

  // d: and Workspace are single-child, so navigation starts where it branches.
  const start = collapseToPresentable(tree);
  assert.equal(start.fullPath, "/d:/Workspace");

  const folders = listChildFolders(start);
  // personal's newest activity (400) beats everviz's (300); everviz has one
  // child so it collapses to a single row.
  assert.deepEqual(
    folders.map((folder) => folder.label),
    ["personal", "everviz/everviz"]
  );
  assert.equal(folders[0].totalSessions, 11); // 8 + 1 + 2
  assert.equal(folders[1].totalSessions, 8);
});
