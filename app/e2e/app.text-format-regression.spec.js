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

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "" })
  );
  expect(id).toBeTruthy();

  await page.evaluate(
    ([annotationId]) => window.__maniE2E?.narrowTextAnnotationForTest?.(annotationId, 90),
    [id]
  );

  const typed = await page.evaluate(
    ([annotationId, phrase]) =>
      window.__maniE2E?.typeInTextEditorForTest?.(annotationId, phrase),
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
      const hasColor =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
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
      const hasColor =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
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
      const hasColor =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
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
      const hasColor =
        /color\s*:\s*#?cc0000|color\s*:\s*rgb\(\s*204\s*,\s*0\s*,\s*0\s*\)/i.test(h);
      return (
        !hasColor &&
        f?.bold === "none" &&
        f?.italic === "none" &&
        (f?.text || "").includes("rouge")
      );
    },
    id,
    { timeout: 10000 }
  );

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
