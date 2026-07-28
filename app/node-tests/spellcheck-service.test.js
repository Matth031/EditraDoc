const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const spellcheckService = require("../src/main/spellcheck-service.js");

beforeEach(() => {
  spellcheckService.invalidateAll();
});

afterEach(() => {
  spellcheckService.invalidateAll();
});

test("findMisspellings: sans spell -> []", () => {
  assert.deepEqual(spellcheckService.findMisspellings(null, "hello"), []);
});

test("findMisspellings: texte null -> []", () => {
  const spell = { correct: () => false, suggest: () => [] };
  assert.deepEqual(spellcheckService.findMisspellings(spell, null), []);
});

test("findMisspellings: mots corrects -> []", () => {
  const spell = { correct: () => true, suggest: () => [] };
  assert.deepEqual(spellcheckService.findMisspellings(spell, "bonjour"), []);
});

test("findMisspellings: mot incorrect avec suggestions", () => {
  const spell = {
    correct: (w) => w !== "trste",
    suggest: (w) => (w === "trste" ? ["triste"] : [])
  };
  const r = spellcheckService.findMisspellings(spell, "je suis trste");
  assert.equal(r.length, 1);
  assert.equal(r[0].word, "trste");
  assert.ok(r[0].suggestions.includes("triste"));
});

test("findMisspellings: mot d'une lettre ignoré", () => {
  const spell = { correct: () => false, suggest: () => ["x"] };
  const r = spellcheckService.findMisspellings(spell, "a b");
  assert.equal(r.length, 0);
});

test("findMisspellings: erreur correct() ignorée par mot", () => {
  const spell = {
    correct: () => {
      throw new Error("x");
    },
    suggest: () => []
  };
  assert.deepEqual(spellcheckService.findMisspellings(spell, "hello"), []);
});

test("mergePersonalWords: sans spell", () => {
  assert.doesNotThrow(() => spellcheckService.mergePersonalWords(null, ["a"]));
});

test("mergePersonalWords: words pas tableau", () => {
  const spell = { add: () => {} };
  assert.doesNotThrow(() => spellcheckService.mergePersonalWords(spell, "not-array"));
});

test("mergePersonalWords: ajoute mots", () => {
  const added = [];
  const spell = {
    add: (w) => {
      added.push(w);
    }
  };
  spellcheckService.mergePersonalWords(spell, ["  foo ", "", "bar"]);
  assert.deepEqual(added, ["foo", "bar"]);
});

test("mergePersonalWords: add lève -> ignoré", () => {
  const spell = {
    add: () => {
      throw new Error("nope");
    }
  };
  assert.doesNotThrow(() => spellcheckService.mergePersonalWords(spell, ["x"]));
});

test("getSpell: langue inconnue -> null", async () => {
  const s = await spellcheckService.getSpell("__not-a-lang__");
  assert.equal(s, null);
});

test("getSpell: fr-FR charge nspell", async () => {
  const s = await spellcheckService.getSpell("fr-FR");
  assert.ok(s);
  assert.equal(typeof s.correct, "function");
});

test("invalidateAll: vide le cache charge", async () => {
  await spellcheckService.getSpell("fr-FR");
  assert.equal(spellcheckService.isSpellLoaded("fr-FR"), true);
  spellcheckService.invalidateAll();
  assert.equal(spellcheckService.isSpellLoaded("fr-FR"), false);
});

test("warmLanguages: recharge apres invalidate", async () => {
  await spellcheckService.getSpell("fr-FR");
  spellcheckService.invalidateAll();
  assert.equal(spellcheckService.isSpellLoaded("fr-FR"), false);
  await spellcheckService.warmLanguages(["fr-FR"]);
  assert.equal(spellcheckService.isSpellLoaded("fr-FR"), true);
});

test("getSpell: en-US et es-ES importent les dictionnaires", async () => {
  for (const lang of ["en-US", "es-ES"]) {
    spellcheckService.invalidateAll();
    const s = await spellcheckService.getSpell(lang);
    assert.ok(s, lang);
    assert.equal(typeof s.correct, "function");
  }
});
