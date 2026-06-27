// build-tree.js — turns the flat list of project directories into a navigable
// folder tree, so the picker can drill down (projects → personal → cc-jump)
// instead of dumping every full path in one long list. This is pure data with no
// filesystem access, which keeps the navigation logic easy to reason about and
// to test.

// One node in the tree. `project` is set only when this exact directory has its
// own sessions; a node can have BOTH its own project and child folders (e.g. a
// repo that also contains worktree sub-projects).
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

// Builds the whole tree from the flat project list. Each project's path is split
// into segments, and we walk from the root creating nodes as needed, attaching
// the project at its final segment. Aggregate counts are filled in afterwards.
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

// Splits an absolute path into its non-empty segments.
// "/Users/me/app" -> ["Users", "me", "app"].
function splitIntoSegments(absolutePath) {
  return absolutePath.split("/").filter((segment) => segment.length > 0);
}

// Walks the tree once, bottom-up, recording on each node the total session count
// and most recent activity across itself and all of its descendants. These drive
// the "(N sessions)" badge on a folder and the most-recent-first ordering.
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

// Follows a chain of single-child folders that have no sessions of their own and
// returns the first node worth stopping at — one that branches, or that has its
// own sessions. This is what lets navigation skip past noise like /Users/me,
// where there's no real choice to make.
export function collapseToPresentable(node) {
  let currentNode = node;
  while (currentNode.children.size === 1 && currentNode.project === null) {
    currentNode = firstChildOf(currentNode);
  }
  return currentNode;
}

// Lists a node's child folders as menu-ready entries. Each child is collapsed
// down to its first meaningful node, so a single-child chain shows as one row
// (".claude/worktrees") instead of forcing a click per segment. Entries come
// back most-recently-active first, matching the rest of the UI.
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

// Collapses a child node into a display label: it joins single-child chains into
// one slash-separated label, but stops as soon as a node has its own sessions (we
// must never hide a folder that can itself be resumed) or branches into several.
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
