/**
 * Agrège un rapport ESLint JSON (sortie lint:sonar) : totaux par règle +
 * détail cognitive-complexity.
 *
 * Usage : node scripts/summarize-sonar.mjs <chemin-rapport.json>
 */
import fs from "fs";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("Usage: node scripts/summarize-sonar.mjs <eslint-json-report>");
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const counts = {};
const complexity = [];
let total = 0;

for (const f of data) {
  for (const m of f.messages || []) {
    total++;
    const k = m.ruleId || "unknown";
    counts[k] = (counts[k] || 0) + 1;
    if (k === "sonarjs/cognitive-complexity") {
      const parts = String(f.filePath || "").split(/[\\/]/);
      complexity.push({
        file: parts.slice(-2).join("/"),
        line: m.line,
        msg: m.message
      });
    }
  }
}

console.log("TOTAL", total);
console.log("BY_RULE");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${v}\t${k}`);
}
console.log("COMPLEXITY_COUNT", complexity.length);

function complexityScore(msg) {
  // Message sonarjs : "... Cognitive Complexity from N to the 15 allowed."
  const m = String(msg).match(/complexity from (\d+)/i);
  return m ? Number(m[1]) : 0;
}

complexity.sort((a, b) => complexityScore(b.msg) - complexityScore(a.msg));
for (const c of complexity) {
  console.log(`${c.file}:${c.line} | ${c.msg}`);
}
