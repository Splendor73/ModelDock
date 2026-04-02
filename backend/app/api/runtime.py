from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.services.ollama import (
    RuntimeControlError,
    get_cached_runtime_strategy,
    get_last_runtime_error,
    get_ollama_version,
    list_running_models,
    preload_model,
    unload_model,
)

router = APIRouter(prefix="/runtime", tags=["runtime"])


class RuntimeConfigUpdate(BaseModel):
    keep_alive_enabled: bool
    keep_alive_model: str | None = None
    keep_alive_duration: str = "-1"


class RuntimeModelAction(BaseModel):
    model: str
    keep_alive: str | int | None = None


async def _runtime_payload():
    version = await get_ollama_version()
    try:
        running_models = await list_running_models()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not query Ollama runtime: {exc}") from exc

    return {
        "ollama_version": version,
        "runtime_strategy": get_cached_runtime_strategy(version),
        "last_runtime_error": get_last_runtime_error(),
        "keep_alive_enabled": settings.ollama_keep_alive_enabled,
        "keep_alive_model": settings.ollama_keep_alive_model,
        "keep_alive_duration": settings.ollama_keep_alive_duration,
        "running_models": running_models,
    }


def _runtime_error_message(action: str, exc: Exception) -> str:
    if isinstance(exc, RuntimeControlError):
        return exc.message
    if isinstance(exc, httpx.HTTPStatusError):
        return (
            f"Ollama rejected the {action} request with {exc.response.status_code}. "
            "Check that the selected model exists locally and Ollama is ready."
        )
    return f"Could not {action}: {exc}"


@router.get("")
async def get_runtime_state():
    return await _runtime_payload()


@router.put("")
async def update_runtime_state(req: RuntimeConfigUpdate):
    if req.keep_alive_enabled and not req.keep_alive_model:
        raise HTTPException(status_code=400, detail="Select a model before enabling keep alive")

    previous_enabled = settings.ollama_keep_alive_enabled
    previous_model = settings.ollama_keep_alive_model
    next_model = req.keep_alive_model.strip() if req.keep_alive_enabled and req.keep_alive_model else None
    next_duration = req.keep_alive_duration.strip() or "-1"

    should_unload_previous = (
        previous_enabled
        and previous_model is not None
        and (not req.keep_alive_enabled or previous_model != next_model)
    )
    try:
        if should_unload_previous:
            await unload_model(previous_model)
        if req.keep_alive_enabled and next_model:
            await preload_model(next_model, next_duration)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_runtime_error_message("apply the runtime change", exc)) from exc

    settings.ollama_keep_alive_enabled = req.keep_alive_enabled
    settings.ollama_keep_alive_model = next_model
    settings.ollama_keep_alive_duration = next_duration
    settings.save_local_settings()

    return await _runtime_payload()


@router.post("/load")
async def load_runtime_model(req: RuntimeModelAction):
    try:
        result = await preload_model(req.model, req.keep_alive if req.keep_alive is not None else "-1")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_runtime_error_message("load the model", exc)) from exc
    return {"status": "loaded", "result": result}


@router.post("/unload")
async def unload_runtime_model(req: RuntimeModelAction):
    try:
        result = await unload_model(req.model)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_runtime_error_message("unload the model", exc)) from exc
    return {"status": "unloaded", "result": result}
