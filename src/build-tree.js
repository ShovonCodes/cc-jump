// Builds a navigable folder tree from the flat project list so the picker can
// drill down a level at a time. Pure data, no filesystem access.

// A node's `project` is set only if that exact directory has its own sessions; a
// node can have both a project and child folders (e.g. a repo with worktrees).
function createNode(name, fullPath) {
  return {
    name: name,
    fullPath: fullPath,
    children: new Map(),
    project: null,
    totalSessions: 0,
    mostRecentActivity: 0,
  };
}

// Splits each path into segments, builds nodes along the way, then fills counts.
export function buildProjectTree(projectDirectories) {
  const root = createNode("", "/");

  for (const project of projectDirectories) {
    const segments = splitIntoSegments(project.originalPath);
    let currentNode = root;
    let walkedPath = "";

    for (const segment of segments) {
      walkedPath = walkedPath + "/" + segment;
      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, createNode(segment, walkedPath));
      }
      currentNode = currentNode.children.get(segment);
    }

    currentNode.project = project;
  }

  accumulateTotals(root);
  return root;
}

function splitIntoSegments(absolutePath) {
  return absolutePath.split("/").filter((segment) => segment.length > 0);
}

// Sums each node's session count and newest activity over its whole subtree.
function accumulateTotals(node) {
  let totalSessions = node.project ? node.project.sessionCount : 0;
  let mostRecent = node.project ? node.project.mostRecentActivity : 0;

  for (const child of node.children.values()) {
    accumulateTotals(child);
    totalSessions += child.totalSessions;
    if (child.mostRecentActivity > mostRecent) {
      mostRecent = child.mostRecentActivity;
    }
  }

  node.totalSessions = totalSessions;
  node.mostRecentActivity = mostRecent;
}

// Skips single-child folders with no sessions of their own, stopping at the
// first node that branches or is itself a project — so navigation starts at a
// real choice rather than stepping through /Users/me one segment at a time.
export function collapseToPresentable(node) {
  let currentNode = node;
  while (currentNode.children.size === 1 && currentNode.project === null) {
    currentNode = firstChildOf(currentNode);
  }
  return currentNode;
}

// A node's child folders as menu entries, each collapsed to one row and sorted
// most-recently-active first.
export function listChildFolders(node) {
  const entries = [];

  for (const child of node.children.values()) {
    const collapsed = collapseChildForDisplay(child);
    entries.push({
      label: collapsed.labelSegments.join("/"),
      target: collapsed.node,
      totalSessions: collapsed.node.totalSessions,
      mostRecentActivity: collapsed.node.mostRecentActivity,
    });
  }

  entries.sort(
    (left, right) => right.mostRecentActivity - left.mostRecentActivity
  );
  return entries;
}

// Joins a single-child chain into one "a/b/c" label, stopping at a node that has
// sessions (never hide a resumable folder) or branches.
function collapseChildForDisplay(child) {
  const labelSegments = [child.name];
  let currentNode = child;

  while (currentNode.children.size === 1 && currentNode.project === null) {
    currentNode = firstChildOf(currentNode);
    labelSegments.push(currentNode.name);
  }

  return { node: currentNode, labelSegments: labelSegments };
}

function firstChildOf(node) {
  return node.children.values().next().value;
}
