from pypdf import PdfReader
import os
base = "scripts/spikes/html-to-pdf/out"
for name in ["spike-css-fidelity.pdf", "spike-css-fidelity-playwright.pdf"]:
    p = os.path.join(base, name)
    r = PdfReader(p)
    print("===", name, "pages", len(r.pages), "size", os.path.getsize(p))
    for i, page in enumerate(r.pages):
        mb = page.mediabox
        print(" page", i+1, "mediabox", float(mb.width), "x", float(mb.height))
        t = (page.extract_text() or "").replace("\n", " ")[:100]
        print("  text:", t)
