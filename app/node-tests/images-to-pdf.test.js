/**
 * Couverture réelle de `images-to-pdf.js` (orchestration disque + deps Python injectées).
 * S1 / formats : via `validateImagesToPdfPaths` appelée par `convertImagesToPdf`
 * (complète `images-to-pdf-path.test.js` qui ne require pas ce module).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  convertImagesToPdf,
  validateImagesOnDisk,
  MAX_IMAGE_BYTES
} = require("../src/main/lib/images-to-pdf");

/** PNG 1×1 minimal (valide comme fichier image non vide). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * @returns {{ dir: string, png: string, cleanup: () => void }}
 */
function makeFixtureDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-img2pdf-"));
  const png = path.join(dir, "scan.png");
  fs.writeFileSync(png, TINY_PNG);
  return {
    dir,
    png,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* intentional: tmp cleanup best-effort */
      }
    }
  };
}

describe("validateImagesOnDisk", () => {
  test("fichier manquant → introuvable", () => {
    const r = validateImagesOnDisk([path.join(os.tmpdir(), "no-such-editradoc-img.png")]);
    assert.equal(r.ok, false);
    assert.match(r.error, /introuvable/i);
  });

  test("chemin dossier → invalide", () => {
    const fx = makeFixtureDir();
    try {
      const r = validateImagesOnDisk([fx.dir]);
      assert.equal(r.ok, false);
      assert.match(r.error, /invalide/i);
    } finally {
      fx.cleanup();
    }
  });

  test("fichier vide → image vide", () => {
    const fx = makeFixtureDir();
    const empty = path.join(fx.dir, "empty.png");
    try {
      fs.writeFileSync(empty, Buffer.alloc(0));
      const r = validateImagesOnDisk([empty]);
      assert.equal(r.ok, false);
      assert.match(r.error, /vide/i);
    } finally {
      fx.cleanup();
    }
  });

  test("fichier > MAX_IMAGE_BYTES → trop volumineux", () => {
    const fx = makeFixtureDir();
    const big = path.join(fx.dir, "big.png");
    try {
      const fd = fs.openSync(big, "w");
      try {
        fs.ftruncateSync(fd, MAX_IMAGE_BYTES + 1);
      } finally {
        fs.closeSync(fd);
      }
      const r = validateImagesOnDisk([big]);
      assert.equal(r.ok, false);
      assert.match(r.error, /volumineuse|80/i);
    } finally {
      fx.cleanup();
    }
  });

  test("PNG présent non vide → ok", () => {
    const fx = makeFixtureDir();
    try {
      const r = validateImagesOnDisk([fx.png]);
      assert.equal(r.ok, true);
    } finally {
      fx.cleanup();
    }
  });
});

describe("convertImagesToPdf", () => {
  test("S1 : sortie hors dossier de la 1ʳᵉ image → rejet (pas d’appel Python)", async () => {
    const fx = makeFixtureDir();
    let pythonCalls = 0;
    try {
      const nestedOut = path.join(fx.dir, "nested", "out.pdf");
      const r = await convertImagesToPdf([fx.png], nestedOut, {
        getPythonHealth: async () => {
          pythonCalls += 1;
          return { export_ready: true };
        },
        postToPython: async () => {
          pythonCalls += 1;
          return { ok: true, page_count: 1 };
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /même dossier/i);
      assert.equal(pythonCalls, 0);
    } finally {
      fx.cleanup();
    }
  });

  test("format non raster → rejet avant disque/Python", async () => {
    const fx = makeFixtureDir();
    const gif = path.join(fx.dir, "x.gif");
    let pythonCalls = 0;
    try {
      fs.writeFileSync(gif, TINY_PNG);
      const r = await convertImagesToPdf([gif], undefined, {
        getPythonHealth: async () => {
          pythonCalls += 1;
          return { export_ready: true };
        },
        postToPython: async () => {
          pythonCalls += 1;
          return { ok: true };
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /PNG|JPG|JPEG|supporté/i);
      assert.equal(pythonCalls, 0);
    } finally {
      fx.cleanup();
    }
  });

  test("image absente sur disque → rejet sans Python", async () => {
    const fx = makeFixtureDir();
    let pythonCalls = 0;
    try {
      const missing = path.join(fx.dir, "gone.png");
      const r = await convertImagesToPdf([missing], undefined, {
        getPythonHealth: async () => {
          pythonCalls += 1;
          return { export_ready: true };
        },
        postToPython: async () => {
          pythonCalls += 1;
          return { ok: true };
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /introuvable/i);
      assert.equal(pythonCalls, 0);
    } finally {
      fx.cleanup();
    }
  });

  test("Python / ReportLab indisponible (export_ready false)", async () => {
    const fx = makeFixtureDir();
    let posted = false;
    try {
      const r = await convertImagesToPdf([fx.png], undefined, {
        getPythonHealth: async () => ({ ok: true, export_ready: false }),
        postToPython: async () => {
          posted = true;
          return { ok: true };
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /ReportLab|setup:python/i);
      assert.equal(posted, false);
    } finally {
      fx.cleanup();
    }
  });

  test("getPythonHealth throw → même message indisponible", async () => {
    const fx = makeFixtureDir();
    try {
      const r = await convertImagesToPdf([fx.png], undefined, {
        getPythonHealth: async () => {
          throw new Error("health down");
        },
        postToPython: async () => ({ ok: true })
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /ReportLab|setup:python/i);
    } finally {
      fx.cleanup();
    }
  });

  test("postToPython throw → erreur transport", async () => {
    const fx = makeFixtureDir();
    try {
      const r = await convertImagesToPdf([fx.png], undefined, {
        getPythonHealth: async () => ({ export_ready: true }),
        postToPython: async () => {
          throw new Error("ECONNREFUSED mock");
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /ECONNREFUSED/);
    } finally {
      fx.cleanup();
    }
  });

  test("postToPython ok:false → message métier Python", async () => {
    const fx = makeFixtureDir();
    try {
      const r = await convertImagesToPdf([fx.png], undefined, {
        getPythonHealth: async () => ({ export_ready: true }),
        postToPython: async () => ({ ok: false, error: "Image corrompue (mock)" })
      });
      assert.equal(r.ok, false);
      assert.equal(r.error, "Image corrompue (mock)");
    } finally {
      fx.cleanup();
    }
  });

  test("succès : Python écrit le PDF → ok + pageCount", async () => {
    const fx = makeFixtureDir();
    const out = path.join(fx.dir, "scan.pdf");
    try {
      const r = await convertImagesToPdf([fx.png], out, {
        getPythonHealth: async () => ({ export_ready: true }),
        postToPython: async (route, payload) => {
          assert.equal(route, "/images-to-pdf");
          assert.deepEqual(payload.input_paths, [path.resolve(fx.png)]);
          assert.equal(payload.output_path, path.resolve(out));
          fs.writeFileSync(out, Buffer.from("%PDF-1.4 mock\n%%EOF\n"));
          return { ok: true, page_count: 1 };
        }
      });
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.outputPath, path.resolve(out));
        assert.equal(r.pageCount, 1);
        assert.ok(fs.existsSync(out));
        assert.ok(fs.statSync(out).size > 0);
      }
    } finally {
      fx.cleanup();
    }
  });

  test("Python ok mais PDF absent → rejet post-écriture", async () => {
    const fx = makeFixtureDir();
    const out = path.join(fx.dir, "scan.pdf");
    try {
      const r = await convertImagesToPdf([fx.png], out, {
        getPythonHealth: async () => ({ export_ready: true }),
        postToPython: async () => ({ ok: true, page_count: 1 })
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /introuvable/i);
    } finally {
      fx.cleanup();
    }
  });

  test("Python ok mais PDF vide → rejet", async () => {
    const fx = makeFixtureDir();
    const out = path.join(fx.dir, "scan.pdf");
    try {
      const r = await convertImagesToPdf([fx.png], out, {
        getPythonHealth: async () => ({ export_ready: true }),
        postToPython: async () => {
          fs.writeFileSync(out, Buffer.alloc(0));
          return { ok: true, page_count: 1 };
        }
      });
      assert.equal(r.ok, false);
      assert.match(r.error, /vide/i);
    } finally {
      fx.cleanup();
    }
  });
});
