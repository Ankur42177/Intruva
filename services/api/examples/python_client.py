"""Intruva Developer API — Python example (requests).

    pip install requests
    INTRUVA_API_URL=https://intruva-api.<subdomain>.workers.dev INTRUVA_API_KEY=itv_... \
        python services/api/examples/python_client.py
"""
from __future__ import annotations

import os
import sys
import time
from typing import Any

import requests

API_URL = os.environ.get("INTRUVA_API_URL", "http://127.0.0.1:8787").rstrip("/")
API_KEY = os.environ.get("INTRUVA_API_KEY", "itv_local_dev_only_DO_NOT_USE_IN_PRODUCTION_000000")


class IntruvaError(Exception):
    def __init__(self, status: int, code: str, message: str, request_id: str | None, retry_after: int | None):
        super().__init__(f"{status} {code}: {message} (request_id {request_id})")
        self.status, self.code, self.request_id, self.retry_after = status, code, request_id, retry_after


class Intruva:
    def __init__(self, base_url: str = API_URL, api_key: str = API_KEY, timeout: float = 25.0):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {api_key}"

    def _call(self, method: str, path: str, body: dict[str, Any] | None = None, retries: int = 1) -> dict[str, Any]:
        res = self.session.request(method, self.base_url + path, json=body, timeout=self.timeout)
        if res.status_code == 429 and retries > 0:
            time.sleep(int(res.headers.get("Retry-After", "60")))
            return self._call(method, path, body, retries - 1)
        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.ok:
            err = data.get("error", {})
            raise IntruvaError(
                res.status_code,
                err.get("code", "http_error"),
                err.get("message", res.reason),
                data.get("request_id") or res.headers.get("X-Request-Id"),
                int(res.headers["Retry-After"]) if "Retry-After" in res.headers else None,
            )
        return data

    def health(self) -> dict[str, Any]:
        return self._call("GET", "/v1/health")

    def analyze(self, prompt: str, mode: str = "quick", task_type: str = "auto", target_model: str = "generic") -> dict[str, Any]:
        return self._call("POST", "/v1/analyze", {"prompt": prompt, "mode": mode, "task_type": task_type, "target_model": target_model})

    def optimize(self, prompt: str, answers: list[dict[str, str]] | None = None, mode: str = "quick", task_type: str = "auto", target_model: str = "generic") -> dict[str, Any]:
        return self._call("POST", "/v1/optimize", {"prompt": prompt, "mode": mode, "task_type": task_type, "target_model": target_model, "answers": answers or []})

    def scan(self, text: str, redact: bool = False) -> dict[str, Any]:
        return self._call("POST", "/v1/security/scan", {"text": text, "redact": redact})

    def feedback(self, request_id: str, rating: str, consent_benchmark: bool = False, **extra: str) -> dict[str, Any]:
        return self._call("POST", "/v1/feedback", {"request_id": request_id, "rating": rating, "consent_benchmark": consent_benchmark, **extra})


def main() -> int:
    client = Intruva()
    health = client.health()
    print(f"API {health['api_version']}, engine {health['engine_version']} ({health['mode']})")

    prompt = "Write a launch email to our customers about the new billing dashboard. Keep it under 150 words."
    scan = client.scan(prompt, redact=True)
    print(f"Risk: {scan['risk_level']}, findings: {len(scan['findings'])}")

    analysis = client.analyze(scan.get("redacted_text", prompt), mode="deep")
    print(f"Task: {analysis['task_type']}, overall score {analysis['scores']['overall']:.2f}")
    for q in analysis["questions"]:
        print(f"  ? [{q['field']}] {q['question']}")

    answers = [{"field": q["field"], "kind": "skipped"} for q in analysis["questions"]]
    result = client.optimize(scan.get("redacted_text", prompt), answers=answers, mode="deep", target_model="chatgpt")
    print("\n" + result["optimized"] + "\n")
    print("Preservation:", ", ".join(f"{p['id']}={p['status']}" for p in result["preservation"]))

    client.feedback(result["request_id"], "up", meaning_preserved="yes")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except IntruvaError as e:
        print(f"Intruva API error: {e}", file=sys.stderr)
        sys.exit(1)
