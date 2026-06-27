# cc-jump

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Browse and resume your [Claude Code](https://claude.com/claude-code) sessions, organized by the project they belong to.

```bash
npx cc-jump
```

No install, no config. Run that one command from anywhere.

## The problem

If you use Claude Code across a handful of projects, you end up with a lot of sessions spread across a lot of directories. Claude Code's built-in `/resume` is scoped to whatever directory you happen to be standing in, and it shows everything in one flat list. There's no way to start from a bird's-eye view, see all your projects, and jump into the one you want.

`cc-jump` is that bird's-eye view. Instead of one long flat list, it groups your sessions into the folder tree they actually live in, so you drill down a level at a time — `projects/` → `personal/` → `cc-jump` — until you reach a session. You pick it, and it drops you straight back into that session — in the right directory — as if you'd typed the resume command yourself.

```
npx cc-jump
  → the folders that hold your projects (projects/, work/, …)
  → drill down one level at a time (personal/, work/, …)
  → reach a project, see its sessions (with titles and timestamps)
  → pick a session
  → you're back in Claude Code, resumed, in the right directory
```

Folders with a single child are skipped automatically, so every menu offers a real choice. A folder that has its own sessions *and* sub-projects (like a repo with git worktrees) shows both. `←  Back` is always there to step up a level. The whole thing takes a few seconds and you never have to remember a path or scroll a flat list.

## How it works

Claude Code stores every session on your machine under `~/.claude/projects/`. Each subdirectory there is one project, and inside it there's one `.jsonl` file per session — a full transcript of that conversation.

The subdirectory names are an encoded form of the project's path: Claude Code takes a path like `/Users/you/projects/app` and replaces every `/` with `-`. That encoding is lossy, though — real folder names contain dashes too (think `cc-jump` or `my-web-app`), so you can't reliably turn the encoded name back into a real path. So instead of trusting the folder name, `cc-jump` reads the **actual working directory that each session recorded inside its own transcript**. That value is exact, which means the path you jump back into is always correct.

To label each session, `cc-jump` looks inside the transcript for, in order of preference:

1. the title Claude Code generated for the session (`ai-title`),
2. an older-style `summary` record (for sessions created before that format existed),
3. the first thing you typed, as a fallback.

With every project's real path in hand, `cc-jump` arranges them into the folder tree they share and lets you browse it a level at a time, rather than listing every full path at once. Levels that have only one child are collapsed away so each menu is a genuine choice.

When you pick a session, `cc-jump` runs `claude --resume <session-id>` for you, with the working directory set to that project's real path. It hands your terminal directly to Claude Code, so it feels exactly like you launched it yourself.

It reads your existing Claude Code data and never writes to it. There's nothing to set up and no config file.

## Requirements

- **Node.js 18 or newer.**
- **The `claude` CLI** must be installed and on your `PATH`. If it isn't, install it with `npm install -g @anthropic-ai/claude-code`. (`cc-jump` checks for it and tells you if it's missing.)

## Why I built it

I built this for myself, because I kept losing track of which directory a session was in. If it helps you too, that's the point. It's intentionally small and the code is kept readable on purpose — see [Contributing](#contributing).

## Contributing

Contributions are genuinely welcome, and the codebase is kept deliberately simple so that anyone — at any experience level — can read it top to bottom and make a change with confidence.

Good first contributions:

- **New color themes.** All the colors live in `src/format.js`. Adding alternate palettes (or light-terminal support) is a self-contained change.
- **More session metadata.** Showing things like the git branch, message count, or the last prompt you sent — the data is already in each transcript.
- **Support for new transcript formats.** Claude Code's session format evolves over time; the label-extraction rules in `src/build-labels.js` are designed to be the one place you'd update.
- **Screenshots and demo GIFs.** This README has none yet (it's `v0.1.0`) — a good screen recording of the flow would be a great addition.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to run it locally and what the codebase looks like.

## Similar tools

`cc-jump` isn't the only Claude Code session manager out there, and it isn't trying to out-feature the others. A few worth knowing about:

- **cc-sessions** — session management with broader workflow features.
- **ccrider** — a session browser/manager for Claude Code.
- **claude-sessions-cli** — a CLI for listing and inspecting sessions.
- **claude-code-viewer** — a richer viewer for reading session transcripts.

The difference with `cc-jump` is scope: it does exactly one thing. It's the simplest possible **directory-first** experience you can get from a single `npx` command — see your projects, pick one, resume a session. If you want analytics, exporting, or deep transcript inspection, one of the tools above is probably a better fit.

## License

[MIT](./LICENSE) © ShovonCodes
