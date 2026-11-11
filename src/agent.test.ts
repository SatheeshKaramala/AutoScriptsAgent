import assert from "node:assert/strict";
import test from "node:test";
import { parseDecision } from "./agent.js";

const snapshot = {
  title: "Todo app",
  candidates: [
    { selector: "input.new-todo", label: "New todo", kind: "field" as const },
    { selector: "button.add", label: "Add", kind: "control" as const },
    { selector: "h1", label: "Todos", kind: "text" as const },
  ],
};

test("maps a model target to a known field selector", () => {
  const decision = parseDecision(
    '{"status":"step","action":"fill","target":0,"value":"Buy groceries"}',
    snapshot,
  );
  assert.deepEqual(decision, {
    status: "step",
    candidate: snapshot.candidates[0],
    step: {
      action: "fill",
      selector: "input.new-todo",
      value: "Buy groceries",
    },
  });
});

test("rejects a model-provided selector target", () => {
  assert.throws(
    () =>
      parseDecision(
        '{"status":"step","action":"click","target":8,"selector":"button"}',
        snapshot,
      ),
    /not in the current page snapshot/,
  );
});

test("rejects actions incompatible with the selected target", () => {
  assert.throws(
    () => parseDecision('{"status":"step","action":"fill","target":1,"value":"x"}', snapshot),
    /non-field target/,
  );
});

test("accepts a completed test title", () => {
  assert.deepEqual(parseDecision('{"status":"done","title":"Adds a todo"}', snapshot), {
    status: "done",
    title: "Adds a todo",
  });
});

test("rejects malformed or unsupported model output", () => {
  assert.throws(() => parseDecision("not json", snapshot), /invalid JSON/);
  assert.throws(
    () => parseDecision('{"status":"step","action":"navigate","target":0}', snapshot),
    /unsupported action/,
  );
});
