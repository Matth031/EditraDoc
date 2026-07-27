/**
 * Instrumentation temporaire perf édition — inactive par défaut.
 * Activer : MANI_PDF_PERF_INSTRUMENT=1 (voir preload `isPerfInstrumentEnabled`).
 */
(function () {
  "use strict";

  /** @type {boolean} */
  let enabled = false;

  /** @type {string | null} */
  let activeScenario = null;

  /** @type {number} */
  let scenarioStartedAt = 0;

  /** @type {number} */
  let scenarioStartedAtWall = 0;

  /**
   * @type {{ name: string, startWall: number, endWall: number }[]}
   */
  const scenarioWallWindows = [];

  /** @type {string | null} */
  let renderSourceTag = null;

  /** @type {string | null} */
  let sanitizedHtmlContext = null;

  /**
   * @typedef {{
   *   scenario: string,
   *   label: string,
   *   ms: number,
   *   at: number,
   *   meta?: Record<string, unknown>
   * }} PerfSample
   */

  /** @type {PerfSample[]} */
  const samples = [];

  /**
   * @param {string} label
   * @param {number} ms
   * @param {Record<string, unknown>} [meta]
   */
  function recordSample(label, ms, meta) {
    if (!enabled || !activeScenario) return;
    samples.push({
      scenario: activeScenario,
      label,
      ms,
      at: performance.now(),
      meta: meta || undefined
    });
  }

  /**
   * @param {string} label
   * @param {() => void} fn
   * @param {Record<string, unknown>} [meta]
   */
  function measureSync(label, fn, meta) {
    if (!enabled) {
      fn();
      return;
    }
    const id = `editify-perf-${label}-${samples.length}`;
    performance.mark(`${id}-start`);
    const t0 = performance.now();
    try {
      fn();
    } finally {
      const ms = performance.now() - t0;
      performance.mark(`${id}-end`);
      try {
        performance.measure(label, `${id}-start`, `${id}-end`);
      } catch {
        /* intentional: duplicate measure name */
      }
      recordSample(label, ms, meta);
    }
  }

  /**
   * @param {string} name
   */
  function beginScenario(name) {
    activeScenario = String(name || "scenario");
    scenarioStartedAt = performance.now();
    scenarioStartedAtWall = Date.now();
    try {
      window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.();
    } catch {
      /* intentional */
    }
  }

  function endScenario() {
    if (activeScenario) {
      scenarioWallWindows.push({
        name: activeScenario,
        startWall: scenarioStartedAtWall,
        endWall: Date.now()
      });
    }
    activeScenario = null;
    scenarioStartedAt = 0;
    scenarioStartedAtWall = 0;
    renderSourceTag = null;
    sanitizedHtmlContext = null;
  }

  function beforeRenderFromApplyProps() {
    if (!enabled) return;
    renderSourceTag = "applySelectedProperties";
  }

  function noteSpellIntervalTick() {
    if (!enabled) return;
    recordSample("spell:interval-tick", 0, { kind: "marker" });
  }

  function noteSpellBootTick() {
    if (!enabled) return;
    recordSample("spell:boot-tick", 0, { kind: "marker" });
  }

  /**
   * Installe les wrappers sur les modules déjà chargés (appel depuis renderer.js).
   */
  function install() {
    try {
      enabled = Boolean(window.maniPdfApi?.isPerfInstrumentEnabled?.());
    } catch {
      enabled = false;
    }
    if (!enabled) return;

    const propsMod = window.__editifyAnnotationProps;
    if (propsMod?.applySelectedPropertiesLive) {
      const origLive = propsMod.applySelectedPropertiesLive;
      propsMod.applySelectedPropertiesLive = function applySelectedPropertiesLiveInstrumented() {
        measureSync("applySelectedPropertiesLive", () => origLive.call(this), { path: "live" });
      };
    }

    const ann = window.__editifyAnnotations;
    if (ann?.renderAnnotations) {
      const origRender = ann.renderAnnotations;
      ann.renderAnnotations = function renderAnnotationsInstrumented() {
        const fromProps = renderSourceTag === "applySelectedProperties";
        const source = renderSourceTag || "other";
        measureSync(
          "renderAnnotations",
          () => origRender.call(this),
          { source, fromApplySelectedProperties: fromProps }
        );
        renderSourceTag = null;
      };
    }

    const textHtml = window.__editifyTextHtml;
    if (textHtml?.setSanitizedHtml) {
      const origSet = textHtml.setSanitizedHtml;
      textHtml.setSanitizedHtml = function setSanitizedHtmlInstrumented(el, html) {
        const ctx = sanitizedHtmlContext || "generic";
        measureSync("setSanitizedHtml", () => origSet.call(this, el, html), { context: ctx });
      };
    }
    if (textHtml?.applySpellHighlightsToTextDisplayNode) {
      const origHl = textHtml.applySpellHighlightsToTextDisplayNode;
      textHtml.applySpellHighlightsToTextDisplayNode = function applySpellHighlightsInstrumented(node, item) {
        measureSync("applySpellHighlightsToTextDisplayNode", () => origHl.call(this, node, item), {
          context: sanitizedHtmlContext || "generic"
        });
      };
    }

    const tcm = window.__editifyTextCtxMenu;
    if (tcm?.runBackgroundSpellScanForTextAnnotations) {
      const origScan = tcm.runBackgroundSpellScanForTextAnnotations;
      tcm.runBackgroundSpellScanForTextAnnotations = function runBackgroundSpellScanInstrumented() {
        measureSync("spell:runBackgroundScan", () => origScan.call(this), { kind: "scan-entry" });
      };
    }
  }

  /**
   * Contexte orthographe pour setSanitizedHtml / surlignage.
   * @param {string} ctx
   */
  function setSpellSanitizedContext(ctx) {
    if (!enabled) return;
    sanitizedHtmlContext = String(ctx || "spell");
  }

  function clearSpellSanitizedContext() {
    sanitizedHtmlContext = null;
  }

  /**
   * @param {string} scenarioName
   * @returns {object}
   */
  function summarizeScenario(scenarioName) {
    const rows = samples.filter((s) => s.scenario === scenarioName);
    /**
     * @param {string} label
     */
    function agg(label) {
      const hit = rows.filter((r) => r.label === label && r.meta?.kind !== "marker");
      const count = hit.length;
      const totalMs = hit.reduce((a, r) => a + r.ms, 0);
      const maxMs = hit.length ? Math.max(...hit.map((r) => r.ms)) : 0;
      const fromProps = hit.filter((r) => r.meta?.fromApplySelectedProperties).length;
      return { count, totalMs, maxMs, fromApplySelectedProperties: fromProps };
    }

    const renderRows = rows.filter((r) => r.label === "renderAnnotations");
    const propsLiveRows = rows.filter((r) => r.label === "applySelectedPropertiesLive");
    const wall = scenarioWallWindows.find((w) => w.name === scenarioName);
    let spellIpcFromPreload = [];
    try {
      const ipcAll = window.maniPdfApi?.getPerfInstrumentSpellIpcSamples?.() || [];
      if (wall) {
        spellIpcFromPreload = ipcAll.filter((row) => row.at >= wall.startWall && row.at <= wall.endWall);
      }
    } catch {
      /* intentional */
    }
    const spellIpcRows = rows.filter((r) => r.label === "spell:ipc-analyze");
    const spellScanRows = rows.filter((r) => r.label === "spell:runBackgroundScan");
    const intervalMarkers = rows.filter((r) => r.label === "spell:interval-tick");
    const sanitizedSpell = rows.filter(
      (r) => r.label === "setSanitizedHtml" && String(r.meta?.context || "").startsWith("spell")
    );

    const gestureWindows = propsLiveRows.map((r) => ({
      start: r.at - r.ms,
      end: r.at
    }));

    let contentionWithSpellInterval = 0;
    let contentionWithSpellIpc = 0;
    for (const g of gestureWindows) {
      for (const m of intervalMarkers) {
        if (m.at >= g.start && m.at <= g.end) contentionWithSpellInterval += 1;
      }
      for (const ipc of spellIpcFromPreload) {
        const ipcStart = ipc.at - ipc.ms;
        const ipcEnd = ipc.at;
        if (ipcEnd >= g.start && ipcStart <= g.end) contentionWithSpellIpc += 1;
      }
    }

    return {
      scenario: scenarioName,
      sampleCount: rows.length,
      applySelectedPropertiesLive: agg("applySelectedPropertiesLive"),
      renderAnnotations: agg("renderAnnotations"),
      renderAnnotationsBySource: renderRows.reduce(
        (acc, r) => {
          const src = String(r.meta?.source || "other");
          acc[src] = (acc[src] || 0) + 1;
          return acc;
        },
        /** @type {Record<string, number>} */ ({})
      ),
      setSanitizedHtmlSpell: {
        count: sanitizedSpell.length,
        totalMs: sanitizedSpell.reduce((a, r) => a + r.ms, 0)
      },
      applySpellHighlights: agg("applySpellHighlightsToTextDisplayNode"),
      spellBackgroundScan: agg("spell:runBackgroundScan"),
      spellIntervalTicks: intervalMarkers.length,
      spellIpcAnalyze: {
        count: spellIpcRows.length + spellIpcFromPreload.length,
        totalMs:
          spellIpcRows.reduce((a, r) => a + r.ms, 0) +
          spellIpcFromPreload.reduce((a, r) => a + r.ms, 0),
        maxMs: Math.max(
          spellIpcRows.length ? Math.max(...spellIpcRows.map((r) => r.ms)) : 0,
          spellIpcFromPreload.length ? Math.max(...spellIpcFromPreload.map((r) => r.ms)) : 0
        )
      },
      contentionDuringPropsGesture: {
        spellIntervalTicksOverlapping: contentionWithSpellInterval,
        spellIpcOverlapping: contentionWithSpellIpc
      }
    };
  }

  function getReport() {
    const scenarios = [...new Set(samples.map((s) => s.scenario))];
    return {
      enabled,
      generatedAt: new Date().toISOString(),
      scenarios: scenarios.map((name) => summarizeScenario(name))
    };
  }

  function resetAll() {
    samples.length = 0;
    scenarioWallWindows.length = 0;
    endScenario();
    try {
      window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.();
    } catch {
      /* intentional */
    }
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch {
      /* intentional */
    }
  }

  window.__editifyPerfInstrument = {
    install,
    beginScenario,
    endScenario,
    resetAll,
    getReport,
    beforeRenderFromApplyProps,
    noteSpellIntervalTick,
    noteSpellBootTick,
    setSpellSanitizedContext,
    clearSpellSanitizedContext,
    isEnabled: () => enabled
  };
})();
