#!/usr/bin/env node
// bin/cc-jump.js — the CLI entry point. Its only job is to start the app and make
// sure that any unexpected error exits cleanly, with a short message instead of a
// scary stack trace. (Ctrl+C inside a prompt is handled by the prompt library;
// outside one, Node exits cleanly on its own.)

import { main } from "../src/main.js";

main().catch((unexpectedError) => {
  const reason = unexpectedError && unexpectedError.message
    ? unexpectedError.message
    : String(unexpectedError);
  console.error(`\ncc-jump stopped unexpectedly: ${reason}\n`);
  process.exitCode = 1;
});
