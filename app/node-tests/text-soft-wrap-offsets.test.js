const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeSoftWrapOffsetsAtSpaces } = require("../src/lib/text-soft-wrap-offsets.js");

test("computeSoftWrapOffsetsAtSpaces : une ligne si largeur suffisante", () => {
  const plain = "hello world";
  const measure = (s) => s.length * 8;
  assert.deepEqual(computeSoftWrapOffsetsAtSpaces(plain, 200, measure), []);
});

test("computeSoftWrapOffsetsAtSpaces : coupure apres espace (200px cadre)", () => {
  const plain = "on ajoute un texte voir si ça marche encore !";
  const measure = (s) => s.length * 7;
  const offsets = computeSoftWrapOffsetsAtSpaces(plain, 200, measure);
  assert.ok(offsets.length >= 1);
  for (const o of offsets) {
    assert.ok(/\s/.test(plain[o - 1]), `offset ${o} doit suivre un espace`);
  }
});

test("computeSoftWrapOffsetsAtSpaces : ne coupe jamais un mot sans espace", () => {
  const plain = "supercalifragilistic";
  const measure = (s) => s.length * 10;
  const offsets = computeSoftWrapOffsetsAtSpaces(plain, 50, measure);
  assert.equal(offsets.length, 0);
});

test("computeSoftWrapOffsetsAtSpaces : produit une coupure sur phrase du test E2E", () => {
  const plain = "on ajoute un texte voir si ça marche encore !";
  const charW = 7.2;
  const measure = (s) => s.length * charW;
  const offsets = computeSoftWrapOffsetsAtSpaces(plain, 188, measure);
  assert.ok(offsets.length >= 1);
  const line1 = plain.slice(0, offsets[0]).trim();
  assert.ok(line1.length > 0);
  assert.ok(line1.length < plain.length);
});
