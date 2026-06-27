# Contributing to cc-jump

Thanks for taking a look. This project is small on purpose, and the code is meant to be read by anyone — so don't worry about being an expert. If you can read JavaScript, you can contribute.

## Running it locally

```bash
git clone https://github.com/shovon/cc-jump.git
cd cc-jump
npm install
node bin/cc-jump.js
```

That last command runs the tool exactly the way `npx cc-jump` would, against your own real Claude Code sessions.

To run the tests (they use Node's built-in test runner — no extra dependencies):

```bash
npm test
```

## How the code is laid out

Each file does one job and says so in a comment at the top:

| File | What it does |
| --- | --- |
| `bin/cc-jump.js` | The entry point. Starts the app and keeps errors clean. |
| `src/main.js` | The conductor — runs the navigation loop and handles every edge case. |
| `src/read-sessions.js` | Everything that touches the filesystem: finds and parses sessions. |
| `src/build-tree.js` | Turns the flat project list into the navigable folder tree (pure data). |
| `src/build-labels.js` | Turns a transcript into a short, readable label. |
| `src/prompt-directory.js` | The folder navigation menu (drill down / back). |
| `src/prompt-session.js` | The "pick a session" menu. |
| `src/resume-session.js` | Checks for the `claude` CLI and launches the resume. |
| `src/format.js` | All colors and text formatting in one place. |

## The one rule: keep it readable

This codebase values **clear over clever**. A few specifics:

- Names should read like English: `findSessionsInDirectory`, not `getSess`. No single-letter or cryptic names.
- One function, one job. If a function is doing two things, split it.
- Comments explain **why**, not what. If the code already says what it does, don't repeat it in a comment.
- Long and obvious beats short and surprising. If a one-liner would make a newcomer pause, write the four readable lines instead.
- It's JavaScript with ES modules (`import`/`export`), and the only runtime dependency is the prompt library. Logic stays on Node's standard library.

## Good first contributions

- **New color themes** — everything lives in `src/format.js`.
- **More session metadata** — git branch, message count, last prompt, etc. The data is already in each transcript.
- **New transcript formats** — Claude Code's format changes over time; update the rules in `src/build-labels.js`.
- **Screenshots / demo GIFs** for the README.

## Submitting a change

1. Fork and branch.
2. Make your change, and add or update a test if it's logic (see the `test/` folder for examples).
3. Run `npm test`.
4. Open a pull request describing what you changed and why.

That's it. Thanks for helping make it better.
