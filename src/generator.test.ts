import assert from "node:assert/strict";
import test from "node:test";
import {
  parseManualCases,
  renderPlaywrightTests,
  validateBaseUrl,
} from "./generator.js";

test("parses supported manual test steps", () => {
  const cases = parseManualCases([
    {
      title: "Adds a task",
      steps: [
        { action: "fill", selector: "input.new-todo", value: "Buy groceries" },
        { action: "press", selector: "input.new-todo", key: "Enter" },
        { action: "expectText", selector: ".todo-list", text: "Buy groceries" },
      ],
    },
  ]);

  assert.equal(cases.length, 1);
  assert.equal(cases[0].steps.length, 3);
});

test("rejects unsupported actions with a useful error", () => {
  assert.throws(
    () =>
      parseManualCases([
        { title: "Invalid case", steps: [{ action: "delete", selector: "button" }] },
      ]),
    /unsupported action "delete"/,
  );
});

test("requires an http or https website URL", () => {
  assert.equal(validateBaseUrl("https://example.com"), "https://example.com/");
  assert.throws(() => validateBaseUrl("file:///tmp/page.html"), /Unsupported URL protocol/);
});

test("renders escaped manual inputs as valid Playwright assertions", () => {
  const cases = parseManualCases([
    {
      title: 'Adds "one" task',
      steps: [
        { action: "fill", selector: 'input[name="task"]', value: 'say "hello"' },
        { action: "expectVisible", selector: ".task" },
      ],
    },
  ]);

  const source = renderPlaywrightTests("https://example.com", cases);
  assert.match(source, /page\.goto\("https:\/\/example\.com\/"\)/);
  assert.match(source, /test\("Adds \\"one\\" task"/);
  assert.match(source, /\.fill\("say \\"hello\\""\)/);
  assert.match(source, /\.toBeVisible\(\)/);
});
