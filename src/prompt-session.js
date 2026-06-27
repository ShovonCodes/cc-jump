// prompt-session.js — the second picker: choose which session inside the selected
// project to resume. It renders each session as a readable label, a relative
// timestamp, and a dimmed short id, then reports back the chosen session.

import { select, isCancel } from "@clack/prompts";

import { secondary, dim, faint, formatRelativeTime } from "./format.js";

// Sessions whose transcript gave us no usable label show this instead.
const NO_LABEL_FALLBACK = "(no summary available)";

// The longest a session label is allowed to be before we trim it, so one wordy
// first message can't blow out the width of the whole list.
const MAX_LABEL_LENGTH = 64;

// Shows the session menu and returns the chosen session object, or null if the
// user cancelled. Like the directory picker, null means "back out cleanly".
export async function promptUserToPickSession(sessions) {
  const menuOptions = sessions.map(buildSessionOption);

  const choice = await select({
    message: "Pick a session to resume",
    options: menuOptions,
    maxItems: 12,
  });

  if (isCancel(choice)) {
    return null;
  }
  return choice;
}

// Builds one session row. Real labels read in soft white; the fallback reads in
// faint grey so it's clearly a placeholder, not a real title.
function buildSessionOption(session) {
  const labelText = session.label
    ? secondary(truncate(session.label, MAX_LABEL_LENGTH))
    : faint(NO_LABEL_FALLBACK);

  const relativeTime = dim(formatRelativeTime(session.lastActivity));
  const shortId = faint(shortenSessionId(session.id));

  const label = `${labelText}  ${relativeTime}  ${shortId}`;

  return { value: session, label: label };
}

// Session ids are long UUIDs; the first segment is plenty to recognize one at a
// glance, in the spirit of a short git hash.
function shortenSessionId(sessionId) {
  return sessionId.slice(0, 8);
}

// Trims a string to a maximum length, ending it with an ellipsis when cut.
function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + "…";
}
