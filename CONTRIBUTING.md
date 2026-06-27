# Contributing to cc-jump

The project is small on purpose — if you can read JavaScript, you can contribute.

## Run it locally

```bash
git clone https://github.com/ShovonCodes/cc-jump.git
cd cc-jump
npm install
node bin/cc-jump.js   # same as `npx cc-jump`, against your real sessions
npm test              # Node's built-in test runner, no extra deps
```

## Code layout

| File | What it does |
| --- | --- |
| `bin/cc-jump.js` | Entry point. |
| `src/main.js` | Runs the navigation loop and handles edge cases. |
| `src/read-sessions.js` | Filesystem: finds and parses sessions. |
| `src/build-tree.js` | Builds the navigable folder tree (pure data). |
| `src/build-labels.js` | Turns a transcript into a short label. |
| `src/prompt-directory.js` | The folder navigation menu. |
| `src/prompt-session.js` | The "pick a session" menu. |
| `src/resume-session.js` | Checks for `claude` and launches the resume. |
| `src/format.js` | Colors and text formatting. |

Keep it readable: clear names, one job per function, and comments that explain *why* rather than restate the code.

## Good first contributions

- **Color themes** — everything lives in `src/format.js`.
- **More session metadata** — git branch, message count, last prompt; the data is already in each transcript.
- **New transcript formats** — update the rules in `src/build-labels.js`.
- **A better demo GIF** — refresh `assets/cc-jump.gif` (see `assets/README.md`).

## Submitting

Fork, branch, make your change (add a test for logic — see `test/`), run `npm test`, and open a PR describing what and why.
