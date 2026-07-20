const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

describe("shape geometry parity JS ↔ Python", () => {
  it("SHAPE_POLYGON_POINTS (renderer-shape-vector.js) === SHAPE_PCT (pdf_ops.py)", async () => {
    const { assertShapeGeometryParity } = await import("../scripts/shape-geometry-parity.mjs");
    const appRoot = path.resolve(__dirname, "..");
    assert.doesNotThrow(() => assertShapeGeometryParity(appRoot));
  });
});
