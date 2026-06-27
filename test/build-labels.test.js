// Tests for the label extraction rules — the part most likely to need changes as
// Claude Code's transcript format evolves, so it's the part most worth pinning down.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSessionLabel } from "../src/build-labels.js";

test("prefers the ai-title over everything else", () => {
  const records = [
    { type: "user", message: { content: "do the thing" } },
    { type: "ai-title", aiTitle: "Set up the build pipeline" },
    { type: "summary", summary: "old style summary" },
  ];
  assert.equal(buildSessionLabel(records), "Set up the build pipeline");
});

test("uses the most recent ai-title when there are several", () => {
  const records = [
    { type: "ai-title", aiTitle: "First guess" },
    { type: "ai-title", aiTitle: "Better title after more context" },
  ];
  assert.equal(buildSessionLabel(records), "Better title after more context");
});

test("falls back to a legacy summary when there is no ai-title", () => {
  const records = [
    { type: "summary", summary: "Refactor the auth layer" },
    { type: "user", message: { content: "hello" } },
  ];
  assert.equal(buildSessionLabel(records), "Refactor the auth layer");
});

test("falls back to the first user message when nothing else is available", () => {
  const records = [
    { type: "assistant", message: { content: "hi" } },
    { type: "user", message: { content: "Help me debug this crash" } },
  ];
  assert.equal(buildSessionLabel(records), "Help me debug this crash");
});

test("reads the first text block out of array-shaped message content", () => {
  const records = [
    {
      type: "user",
      message: {
        content: [
          { type: "tool_result", content: "ignored tool output" },
          { type: "text", text: "Explain this function" },
        ],
      },
    },
  ];
  assert.equal(buildSessionLabel(records), "Explain this function");
});

test("collapses newlines and extra spaces into a single tidy line", () => {
  const records = [
    { type: "user", message: { content: "line one\n\n  line   two" } },
  ];
  assert.equal(buildSessionLabel(records), "line one line two");
});

test("returns null when the records yield nothing usable", () => {
  assert.equal(buildSessionLabel([]), null);
  assert.equal(buildSessionLabel([{ type: "system", content: "boot" }]), null);
});
