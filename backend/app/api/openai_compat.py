import json
import time
import uuid

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.database import get_db
from app.services.api_keys import validate_api_key
from app.services.ollama import chat_completion, generate_embeddings
from app.services.request_logger import log_request

router = APIRouter(tags=["openai-compatible"])


async def _authenticate(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid API key",
                    "type": "authentication_error",
                    "code": "invalid_api_key",
                }
            },
        )
    raw_key = authorization[7:]
    key_info = await validate_api_key(raw_key)
    if key_info is None:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid API key",
                    "type": "authentication_error",
                    "code": "invalid_api_key",
                }
            },
        )
    return key_info


@router.get("/models")
async def list_models(authorization: str | None = Header(None)):
    key_info = await _authenticate(authorization)
    db = await get_db()
    models = []
    async with db.execute(
        "SELECT ollama_name, can_chat, can_embed, synced_at FROM model_configs WHERE workspace_id = ?",
        (key_info["workspace_id"],),
    ) as cursor:
        async for row in cursor:
            models.append(
                {
                    "id": row["ollama_name"],
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "local-ollama",
                    "capabilities": {
                        "chat": bool(row["can_chat"]),
                        "embeddings": bool(row["can_embed"]),
                    },
                }
            )
    return {"object": "list", "data": models}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    temperature: float = 0.7
    top_p: float = 1.0
    max_tokens: int | None = None
    stream: bool = False
    stop: str | list[str] | None = None


@router.post("/chat/completions")
async def chat_completions(
    req: ChatCompletionRequest,
    authorization: str | None = Header(None),
):
    key_info = await _authenticate(authorization)
    start_time = time.time()
    request_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    db = await get_db()
    model = req.model
    if model is None:
        async with db.execute(
            "SELECT ollama_name FROM model_configs WHERE workspace_id = ? AND is_default_chat = 1",
            (key_info["workspace_id"],),
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                model = row["ollama_name"]
    if model is None:
        await log_request(
            workspace_id=key_info["workspace_id"],
            api_key_id=key_info["id"],
            endpoint="/v1/chat/completions",
            method="POST",
            model_used=None,
            status_code=400,
            latency_ms=int((time.time() - start_time) * 1000),
            error_code="model_not_specified",
            error_message="No model specified and no default set",
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "message": "No model specified and no default model set",
                    "type": "invalid_request_error",
                    "code": "model_not_specified",
                }
            },
        )

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        if req.stream:

            async def stream_response():
                prompt_tokens = sum(len(m["content"]) // 4 for m in messages)
                completion_tokens = 0
                try:
                    async for chunk_data in chat_completion(
                        model=model,
                        messages=messages,
                        stream=True,
                        temperature=req.temperature,
                        max_tokens=req.max_tokens,
                    ):
                        parsed = json.loads(chunk_data)
                        content = parsed.get("message", {}).get("content", "")
                        completion_tokens += len(content) // 4
                        sse_chunk = {
                            "id": request_id,
                            "object": "chat.completion.chunk",
                            "created": int(time.time()),
                            "model": model,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": content},
                                    "finish_reason": None,
                                }
                            ],
                        }
                        if parsed.get("done"):
                            sse_chunk["choices"][0]["finish_reason"] = "stop"
                            sse_chunk["choices"][0]["delta"] = {}
                        yield f"data: {json.dumps(sse_chunk)}\n\n"
                    yield "data: [DONE]\n\n"
                    await log_request(
                        workspace_id=key_info["workspace_id"],
                        api_key_id=key_info["id"],
                        endpoint="/v1/chat/completions",
                        method="POST",
                        model_used=model,
                        status_code=200,
                        latency_ms=int((time.time() - start_time) * 1000),
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=prompt_tokens + completion_tokens,
                    )
                except Exception as e:
                    await log_request(
                        workspace_id=key_info["workspace_id"],
                        api_key_id=key_info["id"],
                        endpoint="/v1/chat/completions",
                        method="POST",
                        model_used=model,
                        status_code=503,
                        latency_ms=int((time.time() - start_time) * 1000),
                        error_code="ollama_error",
                        error_message=str(e),
                    )
                    error_chunk = {
                        "error": {
                            "message": f"Ollama error: {e}",
                            "type": "service_unavailable",
                            "code": "ollama_error",
                        }
                    }
                    yield f"data: {json.dumps(error_chunk)}\n\n"

            return StreamingResponse(
                stream_response(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            result = None
            async for data in chat_completion(
                model=model,
                messages=messages,
                stream=False,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            ):
                result = data

            content = result.get("message", {}).get("content", "")
            prompt_tokens = result.get("prompt_eval_count", sum(len(m["content"]) // 4 for m in messages))
            completion_tokens = result.get("eval_count", len(content) // 4)

            latency_ms = int((time.time() - start_time) * 1000)
            await log_request(
                workspace_id=key_info["workspace_id"],
                api_key_id=key_info["id"],
                endpoint="/v1/chat/completions",
                method="POST",
                model_used=model,
                status_code=200,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            )

            return {
                "id": request_id,
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                },
            }

    except HTTPException:
        raise
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        await log_request(
            workspace_id=key_info["workspace_id"],
            api_key_id=key_info["id"],
            endpoint="/v1/chat/completions",
            method="POST",
            model_used=model,
            status_code=503,
            latency_ms=latency_ms,
            error_code="ollama_unreachable",
            error_message=str(e),
        )
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "message": "Ollama is unreachable",
                    "type": "service_unavailable",
                    "code": "ollama_unreachable",
                }
            },
        )


class EmbeddingRequest(BaseModel):
    model: str | None = None
    input: str | list[str]


@router.post("/embeddings")
async def create_embeddings(
    req: EmbeddingRequest,
    authorization: str | None = Header(None),
):
    key_info = await _authenticate(authorization)
    start_time = time.time()

    db = await get_db()
    model = req.model
    if model is None:
        async with db.execute(
            "SELECT ollama_name FROM model_configs WHERE workspace_id = ? AND is_default_embed = 1",
            (key_info["workspace_id"],),
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                model = row["ollama_name"]
    if model is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "message": "No embedding model specified and no default set",
                    "type": "invalid_request_error",
                    "code": "model_not_specified",
                }
            },
        )

    texts = req.input if isinstance(req.input, list) else [req.input]
    embeddings = []
    total_tokens = 0
    for i, text in enumerate(texts):
        vec = await generate_embeddings(model, text)
        embeddings.append({"object": "embedding", "index": i, "embedding": vec})
        total_tokens += len(text) // 4

    latency_ms = int((time.time() - start_time) * 1000)
    await log_request(
        workspace_id=key_info["workspace_id"],
        api_key_id=key_info["id"],
        endpoint="/v1/embeddings",
        method="POST",
        model_used=model,
        status_code=200,
        latency_ms=latency_ms,
        prompt_tokens=total_tokens,
        total_tokens=total_tokens,
    )

    return {
        "object": "list",
        "data": embeddings,
        "model": model,
        "usage": {"prompt_tokens": total_tokens, "total_tokens": total_tokens},
    }
