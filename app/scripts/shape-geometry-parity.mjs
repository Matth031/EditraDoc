/**
 * Parité géométrie formes : SHAPE_POLYGON_POINTS (renderer.js) vs SHAPE_PCT (pdf_ops.py).
 * Lecture directe des sources — pas de JSON partagé.
 */
import fs from "node:fs";
import path from "node:path";

/** @typedef {[number, number]} Point */
/** @typedef {Record<string, Point[]>} ShapeMap */

export const EXPECTED_SHAPE_COUNT = 11;

const EXPECTED_SHAPE_NAMES = [
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "arrow",
  "heart",
  "cross",
  "parallelogram",
  "trapezoid"
];

/**
 * @param {string} rendererJsPath
 * @returns {ShapeMap}
 */
export function loadJsShapePolygons(rendererJsPath) {
  const src = fs.readFileSync(rendererJsPath, "utf8");
  const match = src.match(/const SHAPE_POLYGON_POINTS = \{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error(
      `SHAPE_POLYGON_POINTS introuvable dans ${rendererJsPath} (regex échouée — format renommé ?)`
    );
  }
  /** @type {ShapeMap} */
  const shapes = {};
  for (const m of match[1].matchAll(/(\w+):\s*"([^"]+)"/g)) {
    shapes[m[1]] = m[2]
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return [x, y];
      });
  }
  return shapes;
}

/**
 * @param {string} pdfOpsPyPath
 * @returns {ShapeMap}
 */
export function loadPyShapePct(pdfOpsPyPath) {
  const src = fs.readFileSync(pdfOpsPyPath, "utf8");
  const match = src.match(
    /SHAPE_PCT: dict\[str, list\[tuple\[float, float\]\]\] = \{([\s\S]*?)\n    \}/
  );
  if (!match) {
    throw new Error(
      `SHAPE_PCT introuvable dans ${pdfOpsPyPath} (regex échouée — format renommé ?)`
    );
  }
  /** @type {ShapeMap} */
  const shapes = {};
  for (const m of match[1].matchAll(/"(\w+)":\s*\[([\s\S]*?)\](?=,\s*(?:"|#|$))/g)) {
    shapes[m[1]] = [...m[2].matchAll(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].map((x) => [
      Number(x[1]),
      Number(x[2])
    ]);
  }
  return shapes;
}

/**
 * @param {ShapeMap} jsShapes
 * @param {ShapeMap} pyShapes
 * @returns {{ ok: boolean, mismatches: string[] }}
 */
export function compareShapeGeometry(jsShapes, pyShapes) {
  /** @type {string[]} */
  const mismatches = [];
  const jsKeys = Object.keys(jsShapes).sort();
  const pyKeys = Object.keys(pyShapes).sort();

  for (const key of jsKeys) {
    if (!pyShapes[key]) {
      mismatches.push(`clé absente côté Python : "${key}"`);
      continue;
    }
    const jsPts = jsShapes[key];
    const pyPts = pyShapes[key];
    if (jsPts.length !== pyPts.length) {
      mismatches.push(
        `${key}: nombre de points différent (JS=${jsPts.length}, PY=${pyPts.length})`
      );
      continue;
    }
    for (let i = 0; i < jsPts.length; i += 1) {
      const [jx, jy] = jsPts[i];
      const [px, py] = pyPts[i];
      if (jx !== px || jy !== py) {
        mismatches.push(`${key}: point[${i}] JS=(${jx},${jy}) PY=(${px},${py})`);
      }
    }
  }

  for (const key of pyKeys) {
    if (!jsShapes[key]) {
      mismatches.push(`clé absente côté JS : "${key}"`);
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

/**
 * @param {number} count
 * @param {"JS"|"Python"} side
 */
function assertExtractedShapeCount(count, side) {
  if (count === 0) {
    throw new Error(
      `Parité formes : extraction ${side} a retourné 0 forme — le parsing regex est probablement cassé.`
    );
  }
  if (count !== EXPECTED_SHAPE_COUNT) {
    throw new Error(
      `Parité formes : extraction ${side} = ${count} forme(s), attendu ${EXPECTED_SHAPE_COUNT}. ` +
        `Attendu : ${EXPECTED_SHAPE_NAMES.join(", ")}`
    );
  }
}

/**
 * @param {string} appRoot Répertoire app/ (contient src/ et python/)
 * @throws {Error}
 */
export function assertShapeGeometryParity(appRoot) {
  const rendererPath = path.join(appRoot, "src", "renderer", "renderer.js");
  const pdfOpsPath = path.join(appRoot, "python", "pdf_ops.py");

  const jsShapes = loadJsShapePolygons(rendererPath);
  const pyShapes = loadPyShapePct(pdfOpsPath);

  assertExtractedShapeCount(Object.keys(jsShapes).length, "JS");
  assertExtractedShapeCount(Object.keys(pyShapes).length, "Python");

  const missingJs = EXPECTED_SHAPE_NAMES.filter((n) => !jsShapes[n]);
  const missingPy = EXPECTED_SHAPE_NAMES.filter((n) => !pyShapes[n]);
  if (missingJs.length) {
    throw new Error(`Parité formes : formes manquantes côté JS : ${missingJs.join(", ")}`);
  }
  if (missingPy.length) {
    throw new Error(`Parité formes : formes manquantes côté Python : ${missingPy.join(", ")}`);
  }

  const { ok, mismatches } = compareShapeGeometry(jsShapes, pyShapes);
  if (!ok) {
    throw new Error(`Parité formes JS ↔ Python échouée :\n  - ${mismatches.join("\n  - ")}`);
  }
}
