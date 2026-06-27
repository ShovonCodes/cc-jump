// Turns a session transcript's records into one short label. Isolated here
// because the labelling rules are the most likely thing to change as Claude
// Code's transcript format evolves.

// Best label we can find, or null. Tries, in order: the generated ai-title, a
// legacy summary record, then the first user message.
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

// The title may be rewritten as the chat grows, so keep the last non-empty one.
function findLatestAiTitle(records) {
  let latestTitle = null;
  for (const record of records) {
    if (record.type === "ai-title" && record.aiTitle) {
      latestTitle = record.aiTitle;
    }
  }
  return latestTitle;
}

// Older transcripts used a "summary" record instead of "ai-title".
function findLegacySummary(records) {
  for (const record of records) {
    if (record.type === "summary" && record.summary) {
      return record.summary;
    }
  }
  return null;
}

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

// Content is a string or an array of blocks; take the first real text block.
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

// Collapse whitespace so the label is always one tidy line.
function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
