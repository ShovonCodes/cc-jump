// Tests for the pure formatting helpers: relative time, home-path shortening, and
// column padding. (The color helpers are no-ops in a non-TTY test run, so there's
// nothing meaningful to assert about them here.)

import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";

import {
  formatRelativeTime,
  shortenHomePath,
  padRight,
} from "../src/format.js";

function secondsAgo(seconds) {
  return new Date(Date.now() - seconds * 1000);
}

test("formatRelativeTime reports very recent times as 'just now'", () => {
  assert.equal(formatRelativeTime(secondsAgo(5)), "just now");
});

test("formatRelativeTime handles the just-now / minutes boundary cleanly", () => {
  // The boundaries are where rounding bugs hide, so pin them explicitly.
  assert.equal(formatRelativeTime(secondsAgo(44)), "just now");
  assert.equal(formatRelativeTime(secondsAgo(45)), "1 minute ago");
  assert.equal(formatRelativeTime(secondsAgo(89)), "1 minute ago");
  assert.equal(formatRelativeTime(secondsAgo(90)), "2 minutes ago");
});

test("formatRelativeTime uses singular and plural units correctly", () => {
  assert.equal(formatRelativeTime(secondsAgo(60)), "1 minute ago");
  assert.equal(formatRelativeTime(secondsAgo(120)), "2 minutes ago");
});

test("formatRelativeTime scales up through hours and days", () => {
  assert.equal(formatRelativeTime(secondsAgo(60 * 60 * 2)), "2 hours ago");
  assert.equal(formatRelativeTime(secondsAgo(60 * 60 * 24 * 3)), "3 days ago");
});

test("shortenHomePath replaces the home directory with ~", () => {
  const insideHome = os.homedir() + "/projects/app";
  assert.equal(shortenHomePath(insideHome), "~/projects/app");
});

test("shortenHomePath turns the home directory itself into ~", () => {
  assert.equal(shortenHomePath(os.homedir()), "~");
});

test("shortenHomePath leaves paths outside home untouched", () => {
  assert.equal(shortenHomePath("/var/log/system"), "/var/log/system");
});

test("padRight pads short strings and never truncates long ones", () => {
  assert.equal(padRight("ab", 5), "ab   ");
  assert.equal(padRight("abcdef", 3), "abcdef");
});
