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

  // --- Lot B : cas limites géométrie (complétude) — L99 window.__editify… laissé ENV ---

  it("normalizeRotation : Number(deg) || 0 (NaN / non numérique → 0)", () => {
    assert.equal(normalizeRotation(NaN), 0);
    assert.equal(normalizeRotation("nope"), 0);
    assert.equal(normalizeRotation(undefined), 0);
    assert.equal(normalizeRotation(null), 0);
  });

  it("rotateAnnotationBox : delta === 0 → copie shallow inchangée", () => {
    const item = { x: 1, y: 2, w: 3, h: 4, rotation: 15, tag: "keep" };
    const out = rotateAnnotationBox(item, 0, 400, 300);
    assert.deepEqual(out, item);
    assert.notEqual(out, item);
  });

  it("rotateAnnotationBox : boîte sans w/h (fallback 0) + delta 270 direct", () => {
    const item = { x: 10, y: 20, rotation: 0 };
    const out = rotateAnnotationBox(item, 270, 400, 300);
    // w=0,h=0 → nx = canvasH - y - h = 300 - 20 - 0 = 280 ; ny = x = 10 ; nw=h=0 ; nh=w=0
    assert.equal(out.x, 280);
    assert.equal(out.y, 10);
    assert.equal(out.w, 0);
    assert.equal(out.h, 0);
    assert.equal(out.rotation, 270);
  });

  it("rotateAnnotationsOnPage : early-return non-array → []", () => {
    assert.deepEqual(rotateAnnotationsOnPage(null, 90, 100, 100), []);
    assert.deepEqual(rotateAnnotationsOnPage(undefined, 90, 100, 100), []);
    assert.deepEqual(rotateAnnotationsOnPage({ x: 1 }, 90, 100, 100), []);
  });

  it("rotateAnnotationsOnPage : early-return tableau vide", () => {
    assert.deepEqual(rotateAnnotationsOnPage([], 90, 100, 100), []);
  });

  it("rotateAnnotationsOnPage : canvasW/H <= 0 → copies sans rotation", () => {
    const annos = [{ x: 5, y: 6, w: 7, h: 8, rotation: 10 }];
    const outW = rotateAnnotationsOnPage(annos, 90, 0, 100);
    const outH = rotateAnnotationsOnPage(annos, 90, 100, -1);
    assert.equal(outW[0].x, 5);
    assert.equal(outW[0].rotation, 10);
    assert.equal(outH[0].y, 6);
    assert.equal(outH[0].rotation, 10);
    assert.notEqual(outW[0], annos[0]);
  });

  it("rotateAnnotationThroughDeltas : bras 270 du swap W/H", () => {
    const item = { x: 40, y: 60, w: 120, h: 80, rotation: 0 };
    // Un seul 270° : swap canvas pour une éventuelle suite ; ici on vérifie la géométrie 270
    const after270 = rotateAnnotationThroughDeltas(item, [270], 400, 300);
    assert.equal(after270.rotation, 270);
    const expected = rotateAnnotationBox(item, 270, 400, 300);
    assert.deepEqual(after270, expected);
    // Enchaînement 270 puis 90 : le swap W/H après 270 doit alimenter le canvas de la 2e étape
    const chained = rotateAnnotationThroughDeltas(item, [270, 90], 400, 300);
    assert.equal(chained.rotation, 0);
    assert.equal(Math.round(chained.x), 40);
    assert.equal(Math.round(chained.y), 60);
    assert.equal(Math.round(chained.w), 120);
    assert.equal(Math.round(chained.h), 80);
  });
});
