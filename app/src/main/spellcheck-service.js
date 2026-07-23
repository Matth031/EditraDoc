/**
 * Correcteur orthographique (nspell + dictionnaires Hunspell npm).
 * Les paquets dictionary-* v3+ sont en ESM (export default { aff, dic }) : plus de require() ni de callback.
 */
const nspell = require("nspell");
const { log } = require("./logger");

/** @type {Map<string, Promise<import('nspell')|null>>} */
const cache = new Map();

function invalidateAll() {
  cache.clear();
}

/**
 * @param {string} langKey ex. fr-FR
 * @returns {Promise<{ aff: Uint8Array, dic: Uint8Array }|null>}
 */
async function importDictionary(langKey) {
  try {
    if (langKey === "fr-FR") {
      const m = await import("dictionary-fr");
      return m.default;
    }
    if (langKey === "en-US") {
      const m = await import("dictionary-en");
      return m.default;
    }
    if (langKey === "es-ES") {
      const m = await import("dictionary-es");
      return m.default;
    }
    if (langKey === "pt-PT") {
      const m = await import("dictionary-pt-br");
      return m.default;
    }
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    console.error("[spellcheck] échec import dictionnaire", { langKey, err: msg });
    try {
      log("spellcheck", "import failed", { langKey, err: msg });
    } catch {
      /* intentional: secondary spell log must never throw */
    }
  }
  return null;
}

/**
 * @param {string} langKey ex. fr-FR
 * @returns {Promise<import('nspell')|null>}
 */
function getSpell(langKey) {
  if (!langKey || !cache.has(langKey)) {
    cache.set(
      langKey,
      (async () => {
        const dict = await importDictionary(langKey);
        if (!dict || !dict.aff || !dict.dic) {
          console.error("[spellcheck] dictionnaire absent ou invalide après import", { langKey });
          try {
            log("spellcheck", "no dictionary payload", { langKey });
          } catch {
            /* intentional: secondary spell log must never throw */
          }
          return null;
        }
        try {
          return nspell(dict);
        } catch (e) {
          const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
          console.error("[spellcheck] échec nspell()", { langKey, err: msg });
          try {
            log("spellcheck", "nspell init failed", { langKey, err: msg });
          } catch {
            /* intentional: secondary spell log must never throw */
          }
          return null;
        }
      })()
    );
  }
  return cache.get(langKey);
}

/**
 * @param {import('nspell')} spell
 * @param {string[]} words
 */
function mergePersonalWords(spell, words) {
  if (!spell || !Array.isArray(words)) return;
  for (const w of words) {
    const s = String(w || "").trim();
    if (s.length) {
      try {
        spell.add(s);
      } catch {
        /* intentional: personal dictionary add best-effort */
      }
    }
  }
}

/**
 * @param {import('nspell')} spell
 * @param {string} text
 * @returns {Array<{ word: string, start: number, end: number, suggestions: string[] }>}
 */
function findMisspellings(spell, text) {
  if (!spell || text == null) return [];
  const plain = String(text);
  const out = [];
  const re = /[\p{L}\p{M}]+/gu;
  let m;
  while ((m = re.exec(plain))) {
    const raw = m[0];
    const start = m.index;
    const end = start + raw.length;
    if (raw.length < 2) continue;
    try {
      if (spell.correct(raw)) continue;
      const suggestions = spell.suggest(raw).slice(0, 10);
      out.push({ word: raw, start, end, suggestions });
    } catch {
      /* intentional: skip token on spell analyze error */
    }
  }
  return out;
}

module.exports = {
  getSpell,
  mergePersonalWords,
  findMisspellings,
  invalidateAll
};
