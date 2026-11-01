import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  solve,
  fit,
  predict,
  movingAverage,
  validatePrices,
  metrics,
} from "../site/engine.js";
const rows = Array.from({ length: 100 }, (_, i) => ({
  date: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10),
  close: 100 + i,
}));
test("pivoted solver matches an independent two-equation result", () => {
  const x = solve(
    [
      [2, 1],
      [1, 3],
    ],
    [5, 7],
  );
  assert.ok(Math.abs(x[0] - 1.6) < 1e-10);
  assert.ok(Math.abs(x[1] - 1.8) < 1e-10);
});
test("naive and drift forecasts have transparent values", () => {
  assert.equal(
    predict(
      fit(
        rows.map((r) => r.close),
        "last",
      ),
      [100, 101],
    ),
    101,
  );
  assert.equal(
    predict(
      fit(
        rows.map((r) => r.close),
        "drift",
      ),
      [100, 101],
    ),
    102,
  );
});
test("time ordered evaluation chooses drift on a linear series", () => {
  const r = analyze(rows);
  assert.equal(r.trainEnd, 60);
  assert.equal(r.valEnd, 80);
  assert.equal(r.selected, "drift");
  assert.equal(r.scores.find((s) => s.kind === "drift").test.mae, 0);
  assert.equal(r.future[0], 200);
});
test("changing a later test target cannot change prior predictions", () => {
  const a = analyze(rows),
    other = structuredClone(rows);
  other[95].close = 800;
  const b = analyze(other);
  for (let j = 0; j < 3; j++)
    assert.deepEqual(
      a.scores[j].predictions.slice(0, 15),
      b.scores[j].predictions.slice(0, 15),
    );
  assert.equal(a.selected, b.selected);
});
test("constant series yields stable ridge and zero risk summaries", () => {
  const r = analyze(rows.map((x) => ({ ...x, close: 50 })));
  assert.ok(r.scores.every((s) => s.test.mae < 1e-10));
  assert.equal(r.volatility, 0);
  assert.equal(r.maxDrawdown, 0);
});
test("validation rejects impossible dates duplicate dates and invalid prices", () => {
  for (const change of [
    { date: "2020-02-30" },
    { date: rows[0].date },
    { close: 0 },
    { close: NaN },
    { close: "10" },
  ]) {
    const x = structuredClone(rows);
    Object.assign(x[2], change);
    assert.throws(() => validatePrices(x));
  }
  assert.throws(() => analyze(rows, 0));
  assert.throws(() => analyze(rows.slice(0, 10)));
});
test("trailing average does not peek forward and errors have known scale", () => {
  assert.deepEqual(movingAverage([1, 2, 3, 4], 3), [null, null, 2, 3]);
  assert.deepEqual(metrics([1, 3], [2, 2]), { mae: 1, rmse: 1 });
});
