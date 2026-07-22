/**
 * Régression : sans sélection, Gras / Italique / Souligné s’appliquent à tout le bloc texte
 * (ctxMenuExecFormat sélectionne tout le contentEditable si caret seul).
 * Couleur : sélection partielle en édition, ou textColor sur tout le bloc si fenêtre seule.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) {
    throw new Error(`Fixture PDF introuvable: ${p}`);
  }
  return p;
}

async function launchApp() {
  const pdfPath = getRepoPdfFixture();
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfPath
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function openPdf(app, page) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });
}

test("sans sélection : Gras couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "bonjour monde" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() => window.__maniE2E?.applyCtxFormatToSelectedText?.("bold"));
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<b\b|<strong\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("sans sélection : Italique couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "ligne une" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() => window.__maniE2E?.applyCtxFormatToSelectedText?.("italic"));
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<i\b|<em\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("sans sélection : Souligné couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "souligne moi" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() =>
    window.__maniE2E?.applyCtxFormatToSelectedText?.("underline")
  );
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<u\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("frappe au bord de zone : le texte reste dans l'ordre de saisie", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectTextForTest?.({ plain: "" }));
  expect(id).toBeTruthy();

  await page.evaluate(
    ([annotationId]) => window.__maniE2E?.narrowTextAnnotationForTest?.(annotationId, 90),
    [id]
  );

  const typed = await page.evaluate(
    ([annotationId, phrase]) => window.__maniE2E?.typeInTextEditorForTest?.(annotationId, phrase),
    [id, "Encore une autre fenêtre de texte !"]
  );

  expect(typed).toBe("Encore une autre fenêtre de texte !");

  await e2eCi.closeElectronApp(app);
});

test("sélection partielle : couleur sur un segment seulement", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "aa rouge bb" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(
    ([annotationId, color]) =>
      window.__maniE2E?.applyPartialTextColorForTest?.(annotationId, 3, 8, color),
    [id, "#cc0000"]
  );
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      const hasColorMarkup =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)|color\s*=\s*["']?#?cc0000/i.test(
          h
        );
      const plain = p?.text || "";
      return (
        hasColorMarkup &&
        plain.includes("rouge") &&
        plain.includes("aa") &&
        plain.includes("bb") &&
        p?.textColor !== "#cc0000"
      );
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

/**
 * Chemin UI réel du panneau (nuancier Mani + Valider), sans applyPartialTextColorForTest.
 * Setup uniquement : enterTextEditWithRangeForTest (édition + plage plain).
 */
test("panneau propriétés : couleur partielle via nuancier + Valider", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "aa rouge bb" })
  );
  expect(id).toBeTruthy();

  const prepared = await page.evaluate(
    ([annotationId, start, end]) =>
      window.__maniE2E?.enterTextEditWithRangeForTest?.(annotationId, start, end),
    [id, 3, 8]
  );
  expect(prepared).toBe(true);

  await expect(page.locator("#textPropsPanel")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#textPropsPanel")).not.toHaveClass(/hidden/);

  await page.locator('#textPropsPanel [data-mani-color-for="propTextColor"]').click();
  await expect(page.locator("#maniColorModal")).toBeVisible({ timeout: 5000 });

  await page.locator("#maniColorR").fill("204");
  await page.locator("#maniColorG").fill("0");
  await page.locator("#maniColorB").fill("0");
  await page.locator("#maniColorValidateBtn").click();
  await expect(page.locator("#maniColorModal")).toBeHidden({ timeout: 5000 });

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      const hasColorMarkup =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)|color\s*=\s*["']?#?cc0000/i.test(
          h
        );
      const panel = document.getElementById("textPropsPanel");
      const prop = /** @type {HTMLInputElement | null} */ (
        document.getElementById("propTextColor")
      );
      const panelVisible = !!panel && !panel.classList.contains("hidden");
      const panelColor = String(prop?.value || "").toLowerCase();
      return (
        hasColorMarkup && p?.textColor !== "#cc0000" && panelVisible && panelColor === "#cc0000"
      );
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("fenêtre texte seule : couleur sur tout le bloc", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "tout en bleu" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(
    ([annotationId, color]) => window.__maniE2E?.applyWholeTextColorForTest?.(annotationId, color),
    [id, "#0000cc"]
  );
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      return p?.textColor === "#0000cc";
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("undo séquentiel : italique puis gras puis couleur partielle", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "aa rouge bb" })
  );
  expect(id).toBeTruthy();

  const colorOk = await page.evaluate(
    ([annotationId, color]) =>
      window.__maniE2E?.applyPartialTextColorForTest?.(annotationId, 3, 8, color),
    [id, "#cc0000"]
  );
  expect(colorOk).toBe(true);

  const boldOk = await page.evaluate(
    ([annotationId]) =>
      window.__maniE2E?.applyCtxFormatToTextRangeForTest?.(annotationId, 3, 8, "bold"),
    [id]
  );
  expect(boldOk).toBe(true);

  const italicOk = await page.evaluate(
    ([annotationId]) =>
      window.__maniE2E?.applyCtxFormatToTextRangeForTest?.(annotationId, 3, 8, "italic"),
    [id]
  );
  expect(italicOk).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const f = window.__maniE2E?.getTextInlineFormatForTest?.(annotationId);
      const h = f?.textHtml || "";
      const hasColor = /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
      return hasColor && f?.bold !== "none" && f?.italic !== "none";
    },
    id,
    { timeout: 10000 }
  );

  await page.evaluate(() => window.__maniE2E?.undoForTest?.());
  await page.waitForFunction(
    (annotationId) => {
      const f = window.__maniE2E?.getTextInlineFormatForTest?.(annotationId);
      const h = f?.textHtml || "";
      const hasColor = /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
      return hasColor && f?.bold !== "none" && f?.italic === "none";
    },
    id,
    { timeout: 10000 }
  );

  await page.evaluate(() => window.__maniE2E?.undoForTest?.());
  await page.waitForFunction(
    (annotationId) => {
      const f = window.__maniE2E?.getTextInlineFormatForTest?.(annotationId);
      const h = f?.textHtml || "";
      const hasColor = /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
      return hasColor && f?.bold === "none" && f?.italic === "none";
    },
    id,
    { timeout: 10000 }
  );

  await page.evaluate(() => window.__maniE2E?.undoForTest?.());
  await page.waitForFunction(
    (annotationId) => {
      const f = window.__maniE2E?.getTextInlineFormatForTest?.(annotationId);
      const h = f?.textHtml || "";
      const hasColor = /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
      return (
        !hasColor && f?.bold === "none" && f?.italic === "none" && (f?.text || "").includes("rouge")
      );
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

/**
 * Comportement actuel verrouillé tel quel — voir ticket TKT-UX-UNDO-PANEL-001 pour
 * réévaluation UX (restaurer sélection + resync panneau après undo).
 */
test("undo : sélection vidée et panneau propriétés masqué", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "texte undo panneau" })
  );
  expect(id).toBeTruthy();

  await expect(page.locator("#textPropsPanel")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#textPropsPanel")).not.toHaveClass(/hidden/);

  const beforeUndo = await page.evaluate(() => window.__maniE2E?.getUiState?.());
  expect(beforeUndo?.selectedAnnotationId).toBe(id);

  const changed = await page.evaluate(
    ([annotationId, color]) => window.__maniE2E?.applyWholeTextColorForTest?.(annotationId, color),
    [id, "#0000cc"]
  );
  expect(changed).toBe(true);

  await page.evaluate(() => window.__maniE2E?.undoForTest?.());

  const afterUndo = await page.evaluate(() => {
    const ui = window.__maniE2E?.getUiState?.();
    const panel = document.getElementById("textPropsPanel");
    return {
      selectedAnnotationId: ui?.selectedAnnotationId ?? null,
      panelHidden: !panel || panel.classList.contains("hidden")
    };
  });

  expect(afterUndo.selectedAnnotationId).toBeNull();
  expect(afterUndo.panelHidden).toBe(true);
  await expect(page.locator("#textPropsPanel")).toHaveClass(/hidden/);

  await e2eCi.closeElectronApp(app);
});

/** TKT-BUG-UNDO-EDIT-001 : état cohérent après undo (pas d'édition fantôme). */
test("undo en mode édition : selectedAnnotationId et editingAnnotationId null", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  // Le fix doit vivre dans le module extrait — pas une copie résiduelle dans renderer.js.
  const moduleProbe = await page.evaluate(() => {
    const hist = window.__editifyAnnotationHistory;
    return {
      moduleId: hist?.moduleId || null,
      hasFinish: typeof hist?.finishUndoRedoUi === "function",
      hasUndo: typeof hist?.undo === "function",
      undoForTestWired: typeof window.__maniE2E?.undoForTest === "function"
    };
  });
  expect(moduleProbe.moduleId).toBe("renderer-annotation-history");
  expect(moduleProbe.hasFinish).toBe(true);
  expect(moduleProbe.hasUndo).toBe(true);
  expect(moduleProbe.undoForTestWired).toBe(true);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "texte undo edition" })
  );
  expect(id).toBeTruthy();

  const entered = await page.evaluate(
    (annotationId) => window.__maniE2E?.beginTextEditForTest?.(annotationId),
    id
  );
  expect(entered).toBe(true);

  const typed = await page.evaluate(
    ([annotationId, text]) => window.__maniE2E?.typeInTextEditorForTest?.(annotationId, text),
    [id, " modif"]
  );
  expect(typed).toBeTruthy();

  const beforeUndo = await page.evaluate(() => window.__maniE2E?.getUiState?.());
  expect(beforeUndo?.editingAnnotationId).toBe(id);

  // Spy : undoForTest → wrapper renderer → historyMod.undo (fonction EXTRAITE).
  const spyHits = await page.evaluate(() => {
    const hist = window.__editifyAnnotationHistory;
    let calls = 0;
    const original = hist.undo;
    hist.undo = function patchedUndo() {
      calls += 1;
      return original.apply(this, arguments);
    };
    try {
      window.__maniE2E.undoForTest();
    } finally {
      hist.undo = original;
    }
    return calls;
  });
  expect(spyHits).toBe(1);

  const afterUndo = await page.evaluate(() => window.__maniE2E?.getUiState?.());
  expect(afterUndo?.selectedAnnotationId).toBeNull();
  expect(afterUndo?.editingAnnotationId).toBeNull();
  await expect(page.locator("#annotationLayer .annotation.text.editing")).toHaveCount(0);

  await e2eCi.closeElectronApp(app);
});

test("édition : blanc virtuel final proportionnel à la police, non persisté", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "abc", fontSize: 20 })
  );
  expect(id).toBeTruthy();

  await page.evaluate(
    ([annotationId]) => window.__maniE2E?.beginTextEditForTest?.(annotationId),
    [id]
  );

  const during = await page.evaluate(
    (annotationId) => window.__maniE2E?.getTextEditorVirtualTailForTest?.(annotationId),
    id
  );
  expect(during?.editing).toBe(true);
  expect(during?.textEndsWithSpace).toBe(false);
  expect(during?.text).toBe("abc");
  expect(during?.tailPx).toBeGreaterThan(0);
  expect(during?.paddingRight).toBeGreaterThan(0);
  expect(during?.tailPx).toBeGreaterThanOrEqual(Math.ceil((during?.fontSize || 14) * 0.15));

  await page.keyboard.press("Escape");

  const after = await page.evaluate(
    (annotationId) => window.__maniE2E?.getTextEditorVirtualTailForTest?.(annotationId),
    id
  );
  expect(after?.editing).toBe(false);
  expect(after?.text).toBe("abc");
  expect(after?.textEndsWithSpace).toBe(false);

  await e2eCi.closeElectronApp(app);
});
