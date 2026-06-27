// build-labels.js — turns the raw records of a session transcript into one short,
// human-readable label. This lives in its own module because the rules for what
// makes a good label are the most likely thing to change as Claude Code evolves
// its transcript format, and we want that change to be isolated to one file.

// Given every parsed record from a session's .jsonl file, return the best label
// we can find, or null if the file gave us nothing usable. The caller decides
// what to show in the null case.
//
// We try three sources, best first:
//   1. "ai-title"  — a concise title Claude Code generates for the session.
//   2. "summary"   — an older transcript format we still support for back-compat.
//   3. the first user message — whatever the person typed to start the session.
export function buildSessionLabel(records) {
  const aiTitle = findLatestAiTitle(records);
  if (aiTitle) {
    return collapseWhitespace(aiTitle);
  }

  const legacySummary = findLegacySummary(records);
  if (legacySummary) {
    return collapseWhitespace(legacySummary);
  }

  const firstUserText = findFirstUserMessageText(records);
  if (firstUserText) {
    return collapseWhitespace(firstUserText);
  }

  return null;
}

// Claude Code may rewrite the session's title as the conversation grows, so the
// last "ai-title" record is the most current one. We walk the whole list and
// keep the last non-empty title we see.
function findLatestAiTitle(records) {
  let latestTitle = null;
  for (const record of records) {
    if (record.type === "ai-title" && record.aiTitle) {
      latestTitle = record.aiTitle;
    }
  }
  return latestTitle;
}

// Older Claude Code transcripts stored a "summary" record instead of an
// "ai-title". We read the first one we find for those legacy sessions.
function findLegacySummary(records) {
  for (const record of records) {
    if (record.type === "summary" && record.summary) {
      return record.summary;
    }
  }
  return null;
}

// Falls back to the text of the first message the user sent. This is what people
// remember a session by when no title was ever generated.
function findFirstUserMessageText(records) {
  for (const record of records) {
    if (record.type !== "user" || !record.message) {
      continue;
    }
    const text = extractTextFromMessageContent(record.message.content);
    if (text) {
      return text;
    }
  }
  return null;
}

// A message's content is sometimes a plain string and sometimes an array of
// content blocks (text, tool results, images, ...). We handle both, and from an
// array we take the first actual text block — tool output and images make poor
// labels.
function extractTextFromMessageContent(content) {
  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && block.type === "text" && typeof block.text === "string") {
        const trimmed = block.text.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
  }

  return null;
}

// Collapses newlines and runs of whitespace into single spaces so a label always
// renders as one tidy line, no matter how the original message was formatted.
function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
