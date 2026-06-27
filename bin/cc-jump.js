#!/usr/bin/env node
// CLI entry point: start the app and turn any unexpected error into a short
// message instead of a stack trace.

import { main } from "../src/main.js";

main().catch((unexpectedError) => {
  const reason = unexpectedError && unexpectedError.message
    ? unexpectedError.message
    : String(unexpectedError);
  console.error(`\ncc-jump stopped unexpectedly: ${reason}\n`);
  process.exitCode = 1;
});
