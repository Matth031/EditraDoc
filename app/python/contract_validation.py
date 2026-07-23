"""
Validation JSON Schema partagée (artefacts sous src/contracts/schemas/).
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from jsonschema import Draft7Validator

_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
_SCHEMAS_DIR = os.path.normpath(os.path.join(_SERVICE_DIR, "..", "src", "contracts", "schemas"))


@lru_cache(maxsize=16)
def _load_schema(filename: str) -> dict[str, Any]:
    path = os.path.join(_SCHEMAS_DIR, filename)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def validate_against_schema(filename: str, payload: object) -> tuple[bool, str | None]:
    """
    Valide payload contre un schéma JSON commité.
    Retourne (True, None) si OK, sinon (False, message).
    """
    schema = _load_schema(filename)
    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
    if not errors:
        return True, None
    parts = []
    for err in errors:
        loc = "/" + "/".join(str(p) for p in err.path) if err.path else "/"
        parts.append(f"{loc} {err.message}".strip())
    return False, "; ".join(parts) or "Payload invalide."


def validate_pdf_validate_request(payload: object) -> tuple[bool, str | None]:
    """Contrat POST /validate — avant validate_pdf_path."""
    return validate_against_schema("pdf-validate.request.json", payload)


def validate_apply_annotations_request(payload: object) -> tuple[bool, str | None]:
    """Contrat POST /apply-annotations — avant apply_annotations."""
    return validate_against_schema("apply-annotations.request.json", payload)
