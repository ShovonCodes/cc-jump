// The session picker: choose which session in a project to resume. Renders each
// as a label, a relative time, and a dimmed short id.

import { select, isCancel } from "@clack/prompts";

import { secondary, dim, faint, formatRelativeTime, menuIndent } from "./format.js";

const NO_LABEL_FALLBACK = "(no summary available)";
const MAX_LABEL_LENGTH = 64;

// Returned when the user picks Back, so the loop can tell it from a session or a
// cancel. A Symbol can't collide with any session object.
export const SESSION_BACK = Symbol("session-back");

// Returns the chosen session, SESSION_BACK, or null (cancel). `canGoBack` adds
// the Back row; `depth` indents the list to match the owning folder.
export async function promptUserToPickSession(sessions, canGoBack, depth) {
  const indent = menuIndent(depth + 1);
  const menuOptions = [];

  if (canGoBack) {
    // Back goes up a level, so it isn't indented with the sessions below it.
    menuOptions.push({ value: SESSION_BACK, label: dim("← Back") });
  }
  for (const session of sessions) {
    menuOptions.push(buildSessionOption(session, indent));
  }

  const choice = await select({
    message: "Pick a session to resume",
    options: menuOptions,
    initialValue: canGoBack && sessions.length > 0 ? sessions[0] : undefined,
    maxItems: 12,
  });

  if (isCancel(choice)) {
    return null;
  }
  return choice;
}

// Real labels read in soft white; the fallback in faint grey marks it a placeholder.
// The git branch trails the time when known, taking the slot the id used to hold.
function buildSessionOption(session, indent) {
  const labelText = session.label
    ? secondary(truncate(session.label, MAX_LABEL_LENGTH))
    : faint(NO_LABEL_FALLBACK);

  const relativeTime = dim(formatRelativeTime(session.lastActivity));
  const branch = session.gitBranch ? "  " + faint(session.gitBranch) : "";

  const label = `${indent}${labelText}  ${relativeTime}${branch}`;

  return { value: session, label: label };
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + "…";
}
