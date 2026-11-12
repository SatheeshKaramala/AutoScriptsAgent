# Copilot instructions for AutoScriptsAgent

## Build, test, and lint commands
- `npm run build` type-checks and compiles the CLI and generator into `dist/`.
- `npm run test:unit` builds the project and runs the generator tests with Node's test runner. Run one unit test with `npm run build` followed by `node --test --test-name-pattern="<name>" dist/generator.test.js`.
- `npm test` runs the Playwright suite; `npx playwright test <path>` runs a specific generated spec.
- `npm run sample` generates the TodoMVC example spec. `npm run test:sample` generates and runs it; install browser binaries with `npx playwright install` first.
- No lint command is configured.

## High-level architecture
- `src/cli.ts` parses `--url`, `--cases`, and optional `--out`, reads the manual-case JSON, then writes a Playwright spec.
- `src/agent.ts` runs the supervised Copilot-backed browser explorer. It sends a limited page snapshot to Copilot, validates every proposed step against visible candidates, prompts before state-changing actions and file writes, then optionally runs the generated spec.
- `src/triage.ts` is a read-only Copilot-backed Playwright failure triage CLI. It reads JSON reporter output, retries, trace summaries, and screenshots after explicit upload consent; it must not modify tests or application source.
- `src/generator.ts` validates the URL and supported case/step schema, then renders each manual case as a Playwright test. Generated tests begin at the user-provided URL and use `@playwright/test`.
- `examples/todomvc.json` is the sample input; generated specs default to `tests/generated/manual.spec.ts`. `README.md` documents the input format and commands.

## Key conventions
- Manual cases are a non-empty JSON array. Each case has a non-empty `title` and non-empty ordered `steps` array.
- Supported step actions are `click`, `fill`, `press`, `expectText`, `expectVisible`, and `expectHidden`. Each uses a Playwright locator selector; assertion steps map to Playwright's retrying `expect` assertions.
- Keep runtime validation in `parseManualCases` and generated-code rendering in `renderPlaywrightTests`; the CLI handles file I/O and argument parsing.
- The project uses strict TypeScript with Node's ESM/NodeNext resolution. Internal TypeScript imports use `.js` specifiers so compiled output runs as native ESM.
- `npm run agent -- --url <url> --goal <goal> --authorized` starts the supervised browser agent; its unit tests are included in `npm run test:unit`.
- `npx playwright test --reporter=json > playwright-report.json` produces input for `npm run triage -- --report playwright-report.json`; failure artifacts are retained by Playwright config.
- `npm run triage -- --report <report.json>` triages failed/flaky tests and only sends diagnostics to Copilot after explicit consent.
- The Copilot SDK requires Node.js `^20.19.0` or `>=22.12.0`.
