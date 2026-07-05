"""E-AUDIT-01.6 — plafond base64 images annotation (80 Mo)."""

import base64
import os
import sys
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pdf_ops import ANNOTATION_IMAGE_MAX_BYTES, _decode_annotation_image_base64


class TestAnnotationImageBase64Limit(unittest.TestCase):
    def test_accepts_small_payload(self):
        raw = _decode_annotation_image_base64(base64.b64encode(b"png-bytes").decode("ascii"))
        self.assertEqual(raw, b"png-bytes")

    def test_rejects_oversized_decoded_payload(self):
        oversize = b"x" * (ANNOTATION_IMAGE_MAX_BYTES + 1)
        b64 = base64.b64encode(oversize).decode("ascii")
        with self.assertRaises(RuntimeError) as ctx:
            _decode_annotation_image_base64(b64)
        self.assertIn("80 Mo", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
