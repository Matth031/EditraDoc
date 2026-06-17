const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const html = path.resolve(__dirname, "fixtures", "spike-css-fidelity.html");
  const out = path.resolve(__dirname, "out", "spike-css-fidelity-playwright.pdf");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file:///" + html.replace(/\\/g, "/"));
  await page.pdf({
    path: out,
    printBackground: true,
    preferCSSPageSize: true
  });
  await browser.close();
  console.log("wrote", out, "bytes", fs.statSync(out).size);
})();
