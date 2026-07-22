"""
P1 — validation jsonschema du schéma partagé pdf:read-bytes (request).
Pas de route Python pour ce canal : on prouve que l'infra Python lit le même artefact.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError as exc:  # pragma: no cover
    raise unittest.SkipTest("jsonschema non installé") from exc

APP_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = APP_ROOT / "src" / "contracts" / "schemas" / "pdf-read-bytes.request.json"


class TestContractsPdfReadBytes(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with SCHEMA_PATH.open(encoding="utf-8") as fh:
            cls.schema = json.load(fh)
        cls.validator = Draft7Validator(cls.schema)

    def test_golden_request_accepted(self) -> None:
        errors = list(self.validator.iter_errors({"path": "C:/docs/a.pdf"}))
        self.assertEqual(errors, [])

    def test_invalid_empty_path_rejected(self) -> None:
        errors = list(self.validator.iter_errors({"path": ""}))
        self.assertTrue(errors)

    def test_invalid_missing_path_rejected(self) -> None:
        errors = list(self.validator.iter_errors({"file": "a.pdf"}))
        self.assertTrue(errors)

    def test_invalid_path_type_rejected(self) -> None:
        errors = list(self.validator.iter_errors({"path": 42}))
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
