import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import {
  parseAnalysis,
  parseFailureReport,
  parseTriageArguments,
  renderHtmlReport,
  summarizeTrace,
  extractTraceLocatorTarget,
  locatorCandidates,
  expectedTextFromErrors,
} from "./triage.js";

test("collects unexpected and flaky Playwright tests with their retry evidence", () => {
  const report = parseFailureReport(
    {
      stats: { expected: 4, unexpected: 1, flaky: 1, skipped: 0 },
      suites: [
        {
          title: "todo.spec.ts",
          file: "tests/todo.spec.ts",
          specs: [
            {
              title: "adds a todo",
              file: "tests/todo.spec.ts",
              line: 12,
              tests: [
                {
                  status: "unexpected",
                  projectName: "chromium",
                  results: [
                    {
                      status: "failed",
                      retry: 0,
                      duration: 230,
                      error: { message: "Expected text to be visible" },
                      errors: [],
                      stdout: [{ text: "Attempt output" }],
                      stderr: [],
                      steps: [{ title: "locator.click" }],
                      attachments: [{ name: "trace", contentType: "application/zip" }],
                    },
                    {
                      status: "failed",
                      retry: 1,
                      duration: 220,
                      error: { message: "Expected text to be visible" },
                      errors: [],
                      stdout: [],
                      stderr: [],
                      attachments: [],
                    },
                  ],
                },
                {
                  status: "flaky",
                  projectName: "chromium",
                  results: [
                    {
                      status: "failed",
                      retry: 0,
                      error: { message: "Timeout" },
                      attachments: [],
                    },
                    {
                      status: "passed",
                      retry: 1,
                      attachments: [],
                    },
                  ],
                },
                {
                  status: "expected",
                  projectName: "chromium",
                  results: [{ status: "passed", retry: 0 }],
                },
              ],
            },
          ],
        },
      ],
    },
    "C:\\reports",
  );

  assert.equal(report.stats.unexpected, 1);
  assert.equal(report.tests.length, 2);
  assert.equal(report.tests[0].title, "todo.spec.ts > adds a todo");
  assert.equal(report.tests[0].attempts.length, 2);
  assert.equal(report.tests[0].attempts[1].errors[0], "Expected text to be visible");
  assert.equal(report.tests[1].status, "flaky");
  assert.equal(report.tests[1].attempts[1].status, "passed");
});

test("summarizes trace actions and removes URL query strings", () => {
  const archive = zipSync({
    "1-trace.trace": strToU8(
      [
        JSON.stringify({
          type: "before",
          apiName: "locator.click",
          wallTime: 1_700_000_000_000,
          params: { selector: "button.submit" },
        }),
        JSON.stringify({
          type: "response",
          method: "GET",
          url: "https://example.test/api/items?access_token=secret",
          status: 500,
        }),
        JSON.stringify({
          type: "pageError",
          message: "Uncaught application error",
        }),
      ].join("\n"),
    ),
    "resources/screenshot.png": strToU8("ignored"),
  });

  const summaries = summarizeTrace(archive);
  assert.equal(summaries.length, 3);
  assert.match(summaries[0], /locator\.click/);
  assert.match(summaries[1], /https:\/\/example\.test\/api\/items/);
  assert.doesNotMatch(summaries[1], /access_token|secret/);
  assert.match(summaries[2], /Uncaught application error/);
});

test("validates the Copilot triage response schema", () => {
  const parsed = parseAnalysis(
    JSON.stringify({
      classification: "likely_flaky_test",
      confidence: "medium",
      summary: "The test passed on retry.",
      evidence: ["Attempt 1 failed, attempt 2 passed."],
      next_debugging_steps: ["Inspect trace timings."],
      caveat: "A passing retry does not prove a flaky test.",
    }),
  );
  assert.equal(parsed?.classification, "likely_flaky_test");
  const locatorIssue = parseAnalysis(
    JSON.stringify({
      classification: "likely_test_locator_issue",
      confidence: "high",
      summary: "The failed selector did not match; the matching candidate did.",
      evidence: ["Failure snapshot contains the expected text in the candidate."],
      next_debugging_steps: ["Replace the mistyped test selector."],
      caveat: "Confirm the state matches the intended test.",
    }),
  );
  assert.equal(locatorIssue?.classification, "likely_test_locator_issue");
  assert.equal(parseAnalysis('{"classification":"product bug"}'), undefined);
});

test("rejects malformed or non-Playwright reports explicitly", () => {
  assert.throws(() => parseFailureReport([], "C:\\reports"), /JSON object/);
  assert.throws(() => parseFailureReport({}, "C:\\reports"), /suites array/);
});

test("does not resolve report attachment paths outside the workspace", () => {
  const report = parseFailureReport(
    {
      suites: [
        {
          specs: [
            {
              title: "failed test",
              file: "tests/failure.spec.ts",
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      attachments: [
                        {
                          name: "untrusted",
                          contentType: "text/plain",
                          path: process.execPath,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    "C:\\reports",
  );
  assert.equal(report.tests[0].attempts[0].attachments[0].path, undefined);
});

test("requires explicit consent flag only when requested", () => {
  assert.deepEqual(parseTriageArguments(["--report", "report.json"]), {
    reportPath: "report.json",
    approveUpload: false,
    inspectLocators: false,
    help: false,
  });
  assert.deepEqual(parseTriageArguments(["--report", "report.json", "--yes"]), {
    reportPath: "report.json",
    approveUpload: true,
    inspectLocators: false,
    help: false,
  });
  assert.deepEqual(parseTriageArguments(["--report", "report.json", "--inspect-locators"]), {
    reportPath: "report.json",
    approveUpload: false,
    inspectLocators: true,
    help: false,
  });
  assert.throws(() => parseTriageArguments(["--yes", "--yes"]), /only be specified once/);
  assert.throws(
    () => parseTriageArguments(["--inspect-locators", "--inspect-locators"]),
    /only be specified once/,
  );
});

test("extracts a failed locator and query-free page URL from a trace", () => {
  const archive = zipSync({
    "1-trace.trace": strToU8(
      [
        JSON.stringify({
          type: "before",
          method: "goto",
          params: { url: "https://example.test/todos?token=secret#current" },
        }),
        JSON.stringify({
          type: "before",
          method: "fill",
          params: { selector: "input.new-todo1" },
        }),
        JSON.stringify({
          type: "frame-snapshot",
          snapshot: {
            frameUrl: "https://example.test/todos",
            html: ["HTML", {}, ["BODY", {}, ["UL", { class: "todo-list" }, ["LI", {}, "Buy groceries"]]]],
          },
        }),
        JSON.stringify({
          type: "before",
          method: "expect",
          params: { selector: ".broken li", expectedText: [{ string: "Buy groceries" }] },
        }),
        JSON.stringify({
          type: "frame-snapshot",
          snapshot: { frameUrl: "https://example.test/todos?token=secret", html: ["HTML", {}, ["BODY"]] },
        }),
      ].join("\n"),
    ),
  });

  const target = extractTraceLocatorTarget(archive);
  assert.equal(target.url, "https://example.test/todos");
  assert.equal(target.selector, ".broken li");
  assert.equal(target.action, "expect");
  assert.equal(
    target.snapshotElements?.some(
      (element) => element.text === "Buy groceries" && element.selectors.includes("ul.todo-list li"),
    ),
    true,
  );
  assert.deepEqual(extractTraceLocatorTarget(strToU8("not a zip")), {});
});

test("ranks a unique expected locator from matching selector structure in the page DOM", () => {
  const candidates = locatorCandidates("input.new-todo1", "fill", undefined, [
    {
      tag: "input",
      id: "",
      classes: ["new-todo"],
      attributes: { placeholder: "What needs to be done?" },
      description: '<input class="new-todo">',
      text: "",
      selectors: ["input.new-todo"],
    },
    {
      tag: "button",
      id: "clear-completed",
      classes: [],
      attributes: {},
      description: '<button id="clear-completed">',
      text: "",
      selectors: ["#clear-completed"],
    },
  ]);
  assert.equal(candidates[0].selector, "input.new-todo");
  assert.equal(candidates[0].score, 125);
  assert.match(candidates[0].reason, /matching class name/);
});

test("uses expected assertion text to rank a matching list-item path", () => {
  const candidates = locatorCandidates(".tojalksdj-laskjdfst lisat", "toContainText", "Buy groceries", [
    {
      tag: "li",
      id: "",
      classes: [],
      attributes: {},
      description: "<li>",
      text: "Buy groceries",
      selectors: ["li", "ul.todo-list li"],
    },
    {
      tag: "ul",
      id: "",
      classes: ["todo-list"],
      attributes: {},
      description: '<ul class="todo-list">',
      text: "Buy groceries",
      selectors: ["ul.todo-list"],
    },
  ]);
  assert.equal(candidates[0].selector, "ul.todo-list li");
  assert.equal(candidates[0].score, 165);
  assert.match(candidates[0].reason, /expected assertion text/);
  assert.equal(candidates[0].matchesExpectedText, true);
});

test("extracts expected text from assertion diagnostics", () => {
  assert.equal(
    expectedTextFromErrors([`Expected substring: "\u001b[32mBuy groceries\u001b[39m"`]),
    "Buy groceries",
  );
});

test("renders a safe HTML triage report with the diagnosis and retry history", () => {
  const report = parseFailureReport(
    {
      stats: { unexpected: 1, flaky: 0 },
      suites: [
        {
          title: "suite",
          specs: [
            {
              title: "<script>alert(1)</script>",
              file: "tests/failure.spec.ts",
              line: 8,
              tests: [
                {
                  status: "unexpected",
                  projectName: "chromium",
                  results: [
                    {
                      status: "failed",
                      retry: 0,
                      error: { message: "<img src=x onerror=alert(1)>" },
                      attachments: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    "C:\\reports",
  );
  const html = renderHtmlReport(
    report,
    {
      classification: "likely_flaky_test",
      confidence: "medium",
      summary: "Retry timing suggests a race.",
      evidence: ["First attempt timed out."],
      next_debugging_steps: ["Inspect trace."],
      caveat: "A retry is not proof.",
    },
    "C:\\reports\\report.json",
    new Date("2026-11-12T08:00:00.000Z"),
    [
      {
        testTitle: "failed test",
        retry: 0,
        url: "https://example.test/todos",
        selector: "input.new-todo1",
        status: "not_found",
        count: 0,
        confidence: "high",
        bestCandidate: {
          selector: "input.new-todo",
          count: 1,
          visible: true,
          element: '<input class="new-todo">',
          score: 120,
          reason: "same element type (input); matching class name after numeric-suffix normalization",
          matchedToken: "new-todo",
          source: "current page",
        },
        evidence: [
          "Failed locator matched 0 elements on the inspected page.",
          "Candidate input.new-todo uniquely matched a visible <input class=\"new-todo\">.",
        ],
      },
    ],
  );

  assert.match(html, /Assessment: likely flaky test/);
  assert.match(html, /Attempt 1: failed/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Locator verification/);
  assert.match(html, /Failed locator matched no elements on the inspected page/);
  assert.match(html, /Likely intended locator/);
  assert.match(html, /input\.new-todo/);
  assert.match(html, /high confidence/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
});
