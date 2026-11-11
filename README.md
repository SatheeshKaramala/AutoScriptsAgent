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
