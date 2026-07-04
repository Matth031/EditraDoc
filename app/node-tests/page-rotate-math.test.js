const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeRotation,
  rotateAnnotationBox,
  rotateAnnotationsOnPage,
  rotateAnnotationThroughDeltas
} = require("../src/lib/page-rotate-math.js");

describe("page-rotate-math", () => {
  it("normalizeRotation ramène dans [0,360)", () => {
    assert.equal(normalizeRotation(450), 90);
    assert.equal(normalizeRotation(-90), 270);
  });

  it("rotateAnnotationBox 90° horaire", () => {
    const item = { x: 10, y: 20, w: 100, h: 50, rotation: 0 };
    const out = rotateAnnotationBox(item, 90, 400, 300);
    assert.equal(out.x, 20);
    assert.equal(out.y, 290);
    assert.equal(out.w, 50);
    assert.equal(out.h, 100);
    assert.equal(out.rotation, 90);
  });

  it("rotateAnnotationsOnPage cumule sur plusieurs éléments", () => {
    const annos = [
      { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
      { x: 50, y: 50, w: 20, h: 20, rotation: 15 }
    ];
    const out = rotateAnnotationsOnPage(annos, 180, 200, 100);
    assert.equal(out.length, 2);
    assert.equal(out[0].x, 190);
    assert.equal(out[0].y, 90);
    assert.equal(out[0].rotation, 180);
    assert.equal(out[1].rotation, 195);
  });

  it("chaîne 0→90→180→270 sur une boîte", () => {
    const item = { x: 40, y: 60, w: 120, h: 80, rotation: 0 };
    const after = rotateAnnotationThroughDeltas(item, [90, 90, 90], 400, 300);
    assert.equal(after.rotation, 270);
    const back = rotateAnnotationBox(after, 90, 300, 400);
    assert.equal(back.rotation, 0);
    assert.equal(Math.round(back.x), 40);
    assert.equal(Math.round(back.y), 60);
    assert.equal(Math.round(back.w), 120);
    assert.equal(Math.round(back.h), 80);
  });
});
