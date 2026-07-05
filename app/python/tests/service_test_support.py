"""Utilitaires partagés pour les tests HTTP du service Python (E-AUDIT-01)."""

from __future__ import annotations

import json
import os
import threading
from http.client import HTTPConnection
from http.server import HTTPServer

from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-audit-service-token"


class LocalPdfServiceTestCase:
    """Mixin unittest : démarre un Handler local avec token de test."""

    @classmethod
    def start_local_service(cls) -> None:
        cls._prev_token = os.environ.get("MANI_PDF_SERVICE_TOKEN")
        os.environ["MANI_PDF_SERVICE_TOKEN"] = TEST_SERVICE_TOKEN
        cls.server = HTTPServer(("127.0.0.1", 0), Handler)
        cls.host, cls.port = cls.server.server_address
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def stop_local_service(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        if cls._prev_token is None:
            os.environ.pop("MANI_PDF_SERVICE_TOKEN", None)
        else:
            os.environ["MANI_PDF_SERVICE_TOKEN"] = cls._prev_token

    def service_request(
        self,
        method: str,
        route: str,
        payload: dict | None = None,
        *,
        token: str | None = TEST_SERVICE_TOKEN,
    ) -> tuple[int, dict]:
        conn = HTTPConnection(self.host, self.port, timeout=5)
        body = json.dumps(payload or {})
        headers = {"Content-Type": "application/json"}
        if method == "POST" and token is not None:
            headers["X-Mani-Pdf-Token"] = token
        conn.request(method, route, body=body if method == "POST" else None, headers=headers)
        resp = conn.getresponse()
        data = json.loads(resp.read().decode("utf8") or "{}")
        conn.close()
        return resp.status, data
