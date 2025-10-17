import assert from "node:assert/strict";
import { parseDuration } from "../assets/js/timers.js";

const cases = [
  ["12:34", 754000],
  ["01:02:03", 3723000],
  ["1h30m10s", 5410000],
  ["90s", 90000],
  ["500ms", 500],
  ["15", 15000],
];

for (const [input, expected] of cases) {
  const actual = parseDuration(input);
  assert.strictEqual(
    actual,
    expected,
    `parseDuration(${JSON.stringify(input)}) should be ${expected} but received ${actual}`
  );
}

console.log("✓ parseDuration cases passed");
