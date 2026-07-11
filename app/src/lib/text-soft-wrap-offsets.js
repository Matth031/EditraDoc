"use strict";

/**
 * Offsets de coupure soft-wrap (index dans plain) après un espace — partagé renderer / tests Node.
 * @param {string} plain
 * @param {number} maxWidthPx
 * @param {(segment: string) => number} measureWidth
 */
function computeSoftWrapOffsetsAtSpaces(plain, maxWidthPx, measureWidth) {
  const offsets = [];
  if (!plain || maxWidthPx <= 0 || typeof measureWidth !== "function") return offsets;
  if (measureWidth(plain) <= maxWidthPx + 0.5) return offsets;

  let lineStart = 0;
  let lastBreakCandidate = -1;

  for (let i = 0; i < plain.length; i += 1) {
    if (/\s/.test(plain[i])) {
      lastBreakCandidate = i + 1;
    }
    const segment = plain.slice(lineStart, i + 1);
    if (measureWidth(segment) <= maxWidthPx + 0.5) continue;

    let breakAt = lastBreakCandidate > lineStart ? lastBreakCandidate : i;
    if (breakAt <= lineStart) {
      if (i <= lineStart) continue;
      breakAt = i;
    }
    if (breakAt <= 0 || breakAt >= plain.length) break;
    if (!/\s/.test(plain[breakAt - 1])) continue;

    offsets.push(breakAt);
    lineStart = breakAt;
    lastBreakCandidate = -1;
    i = breakAt - 1;
  }

  return offsets;
}

const textSoftWrapOffsetsApi = {
  computeSoftWrapOffsetsAtSpaces
};

if (typeof window !== "undefined") {
  window.__editifyTextSoftWrapOffsets = textSoftWrapOffsetsApi;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = textSoftWrapOffsetsApi;
}
