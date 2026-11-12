# AutoScriptsAgent

Generate Playwright tests from manually written, structured test cases and a website URL.

## Setup

Use Node.js `^20.19.0` or `>=22.12.0` (required by the Copilot SDK), then install dependencies:

```sh
npm install
npx playwright install
```

## Generate tests

Each case has a title and an ordered list of steps. The supported actions are `click`, `fill`, `press`, `expectText`, `expectVisible`, and `expectHidden`. Selectors use Playwright's `page.locator()` syntax; assertion steps wait using Playwright's built-in assertions.

```sh
npm run build
npm run generate -- --url https://your-site.example --cases path/to/cases.json
```

Generated tests default to `tests/generated/manual.spec.ts`. Change the destination with `--out`. Run generated tests with:

```sh
npx playwright test tests/generated/manual.spec.ts
```

## Supervised Copilot agent

The agent inspects a page, proposes one test step at a time, and builds a test case from the approved interactions. It uses GitHub Copilot through the Copilot SDK, so Copilot CLI must be installed and authenticated. The test goal and a limited page snapshot (page title and visible control/heading labels, not form values) are sent to Copilot. The full URL is saved in the spec; do not include credentials or secrets in it, or use the agent on pages with sensitive content.

The agent requires `--authorized` as an explicit confirmation that you own the site or have permission to test it. It asks before each state-changing browser action, before writing the generated spec, and before running it. Both exploration and the generated test run in visible, slowed-down browsers. The exploration browser stays open at the end until you press Enter. It blocks top-level navigation away from the starting site origin, excludes password and common personal-data fields, and does not expose shell or filesystem tools to the model.

```sh
npm run agent -- --url https://your-site.example --goal "Add a todo and verify it appears" --authorized
```

In PowerShell, use `npm.cmd` if your execution policy blocks `npm.ps1`:

```powershell
npm.cmd run agent -- --url https://your-site.example --goal "Add a todo and verify it appears" --authorized
```

The generated spec defaults to `tests/generated/agent.spec.ts`. Use `--out` to select another `.spec.ts` path inside `tests/generated`. Install the Playwright browser binary if needed with `npx playwright install chromium`.

## Playwright failure triage

The read-only triage agent reviews failed and flaky tests from a Playwright JSON report. It compares retry attempts, examines error/output and step summaries, extracts action/network/error evidence from `trace.zip`, and can inspect a small number of attached screenshots. It asks for explicit approval before sending selected diagnostics and screenshots to GitHub Copilot. It classifies evidence as a likely product bug, likely flaky test, environment/infrastructure issue, or insufficient evidence, then suggests debugging steps. After a successful analysis, it saves a standalone HTML report under `triage-reports/`. It does not edit tests or source files. For safety, attachment files are only read when they resolve inside the current project workspace.

To inspect a failed locator and discover likely alternatives from the page's current DOM, add `--inspect-locators`. In an interactive terminal, triage shows the URL and failed selector and asks before opening the page in a fresh browser context with no saved login state. In a non-interactive terminal, the flag itself is the explicit approval. It examines visible interactive elements, creates candidate selectors from their DOM attributes, ranks candidates against the failed selector and action, and verifies that the best candidate uniquely matches a visible element. The terminal and HTML report show the failed locator, likely intended locator, confidence, and evidence separately. A high-confidence candidate means its element type and selector name closely match the failed locator and it uniquely matches a visible element in the current DOM; it is not proof of what existed during the original failure. The check blocks non-GET/HEAD requests and all cross-origin requests. It does not click or fill controls, but page loads can still have server-side effects. Authentication, app state, timing, or later page changes can affect results. Upload consent to Copilot remains separate; `--inspect-locators` never approves an upload.

Playwright is configured to retain traces and screenshots on failure. First run the tests and save the JSON report:

```powershell
npx.cmd playwright test --reporter=json | Out-File -FilePath playwright-report.json -Encoding utf8
```

Then run triage:

```powershell
npm.cmd run triage -- --report playwright-report.json
```

For an explicitly approved live locator check:

```powershell
npm.cmd run triage -- --report playwright-report.json --inspect-locators
```

Review the listed test names and type `yes` only if you consent to send the selected error/output, sanitized trace events, up to four screenshots, and any live locator verification results to GitHub Copilot. Diagnostic data and screenshots may contain sensitive information. If you decline Copilot upload after a locator check, triage still saves a local HTML report of the check. The analysis is a hypothesis, not proof; verify the suggested cause and debugging steps yourself.

Open the newest `triage-reports/triage-report-*.html` file in a browser to view and share the local HTML artifact. The `triage-reports/` directory is git-ignored by default because reports may contain diagnostic details.

For a non-interactive terminal, `--yes` explicitly approves sending the report's selected diagnostics without asking again. Use it only after reviewing what the report may contain:

```powershell
npm.cmd run triage -- --report playwright-report.json --yes
```

The report includes only tests that failed unexpectedly or passed after a retry. If the run failed, PowerShell may report a non-zero test-run exit status even though it wrote `playwright-report.json`.

Example case file:

```json
[
  {
    "title": "User can sign in",
    "steps": [
      { "action": "fill", "selector": "#email", "value": "user@example.com" },
      { "action": "fill", "selector": "#password", "value": "example-password" },
      { "action": "click", "selector": "button[type=submit]" },
      { "action": "expectVisible", "selector": "text=Welcome" }
    ]
  }
]
```

## Sample

The sample uses the TodoMVC demo at `https://demo.playwright.dev/todomvc`:

```sh
npm run sample
npx playwright test tests/generated/todomvc.spec.ts
```

Run the sample generation and browser test together with `npm run test:sample`.

## Checks

Run the generator unit tests with:

```sh
npm run test:unit
```

Run one unit test by name:

```sh
npm run build
node --test --test-name-pattern="requires an http" dist/generator.test.js
```

Run all Playwright tests with `npm test`.
