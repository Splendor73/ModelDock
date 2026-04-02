import json
from typing import Any

import httpx

from app.core.config import settings


RUNTIME_STRATEGY_MODERN = "generate_modern"
RUNTIME_STRATEGY_LEGACY = "generate_legacy"

_cached_ollama_version: str | None = None
_runtime_strategy_by_version: dict[str, str] = {}
_last_runtime_error: str | None = None


class RuntimeControlError(Exception):
    def __init__(
        self,
        action: str,
        message: str,
        *,
        status_code: int | None = None,
        response_body: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.action = action
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


def _version_cache_key(version: str | None) -> str:
    return version or "__unknown__"


def get_last_runtime_error() -> str | None:
    return _last_runtime_error


def clear_last_runtime_error() -> None:
    global _last_runtime_error
    _last_runtime_error = None


def get_cached_runtime_strategy(version: str | None) -> str | None:
    return _runtime_strategy_by_version.get(_version_cache_key(version))


def _set_runtime_strategy(version: str | None, strategy: str) -> None:
    _runtime_strategy_by_version[_version_cache_key(version)] = strategy


def _remember_runtime_error(message: str) -> None:
    global _last_runtime_error
    _last_runtime_error = message


def _parse_error_payload(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("error", "message", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = _parse_error_payload(value)
                if nested:
                    return nested
    if isinstance(payload, str) and payload.strip():
        return payload.strip()
    return ""


def _normalize_runtime_keep_alive(keep_alive: str | int) -> str | int:
    if keep_alive == "-1":
        return -1
    if keep_alive == "0":
        return 0
    return keep_alive


async def get_ollama_version(force_refresh: bool = False) -> str | None:
    global _cached_ollama_version

    if _cached_ollama_version and not force_refresh:
        return _cached_ollama_version

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/version")
            resp.raise_for_status()
            data = resp.json()
            version = data.get("version")
            if isinstance(version, str) and version.strip():
                _cached_ollama_version = version.strip()
                return _cached_ollama_version
    except (httpx.HTTPError, ValueError, json.JSONDecodeError):
        return _cached_ollama_version

    return _cached_ollama_version


async def _runtime_generate_request(
    action: str,
    model: str,
    keep_alive: str | int,
    strategy: str,
    *,
    timeout: float,
) -> dict:
    payload: dict[str, Any] = {"model": model, "keep_alive": _normalize_runtime_keep_alive(keep_alive)}
    if strategy == RUNTIME_STRATEGY_LEGACY:
        payload.update({"prompt": "", "stream": False})

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)

    if resp.is_success:
        clear_last_runtime_error()
        if not resp.content:
            return {}
        try:
            return resp.json()
        except ValueError:
            return {}

    try:
        error_body = resp.json()
    except ValueError:
        error_body = resp.text

    detail = _parse_error_payload(error_body)
    if not detail:
        detail = f"Ollama rejected the {action} request."

    raise RuntimeControlError(
        action,
        detail,
        status_code=resp.status_code,
        response_body=error_body,
    )


async def _run_runtime_action(action: str, model: str, keep_alive: str | int, *, timeout: float) -> dict:
    version = await get_ollama_version()
    cached_strategy = get_cached_runtime_strategy(version)

    if cached_strategy:
        strategies = [cached_strategy]
        if cached_strategy == RUNTIME_STRATEGY_MODERN:
            strategies.append(RUNTIME_STRATEGY_LEGACY)
        else:
            strategies.append(RUNTIME_STRATEGY_MODERN)
    else:
        strategies = [RUNTIME_STRATEGY_MODERN, RUNTIME_STRATEGY_LEGACY]

    last_error: RuntimeControlError | None = None

    for strategy in strategies:
        try:
            result = await _runtime_generate_request(
                action,
                model,
                keep_alive,
                strategy,
                timeout=timeout,
            )
            _set_runtime_strategy(version, strategy)
            return result
        except RuntimeControlError as exc:
            last_error = exc
            should_retry = exc.status_code == 400 and strategy != strategies[-1]
            if not should_retry:
                break

    if last_error is None:
        last_error = RuntimeControlError(action, f"Could not {action}.")

    _remember_runtime_error(last_error.message)
    raise last_error


async def get_ollama_status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "connected": True,
                    "model_count": len(data.get("models", [])),
                }
    except (httpx.ConnectError, httpx.TimeoutException):
        pass
    return {"connected": False, "model_count": 0}


async def list_ollama_models() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return data.get("models", [])
    except (httpx.ConnectError, httpx.TimeoutException):
        return []
    return []


def _resolve_keep_alive(model: str) -> str | None:
    if not settings.ollama_keep_alive_enabled:
        return None
    if not settings.ollama_keep_alive_model:
        return None
    if settings.ollama_keep_alive_model != model:
        return None
    return settings.ollama_keep_alive_duration


async def list_running_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{settings.ollama_base_url}/api/ps")
        resp.raise_for_status()
        data = resp.json()
        return data.get("models", [])


async def preload_model(model: str, keep_alive: str | int = "-1") -> dict:
    return await _run_runtime_action(
        "load the model",
        model,
        keep_alive,
        timeout=300.0,
    )


async def unload_model(model: str) -> dict:
    return await _run_runtime_action(
        "unload the model",
        model,
        0,
        timeout=60.0,
    )


async def chat_completion(
    model: str,
    messages: list[dict],
    stream: bool = False,
    temperature: float = 0.7,
    max_tokens: int | None = None,
):
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "options": {"temperature": temperature},
    }
    keep_alive = _resolve_keep_alive(model)
    if keep_alive is not None:
        payload["keep_alive"] = keep_alive
    if max_tokens is not None:
        payload["options"]["num_predict"] = max_tokens

    async with httpx.AsyncClient(timeout=300.0) as client:
        if stream:
            async with client.stream(
                "POST",
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line
        else:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
            )
            resp.raise_for_status()
            yield resp.json()


async def generate_embeddings(model: str, text: str) -> list[float]:
    payload = {"model": model, "input": text}
    keep_alive = _resolve_keep_alive(model)
    if keep_alive is not None:
        payload["keep_alive"] = keep_alive
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/embed",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        embeddings = data.get("embeddings", [])
        if embeddings:
            return embeddings[0]
        return []
