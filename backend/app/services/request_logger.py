import uuid

from app.core.database import get_db


async def log_request(
    workspace_id: str,
    api_key_id: str | None = None,
    endpoint: str = "",
    method: str = "POST",
    model_used: str | None = None,
    origin: str = "local",
    status_code: int = 200,
    latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    assistant_id: str | None = None,
    retrieval_used: bool = False,
    error_code: str | None = None,
    error_message: str | None = None,
) -> str:
    db = await get_db()
    log_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO request_logs
           (id, workspace_id, api_key_id, endpoint, method, model_used, origin,
            status_code, latency_ms, prompt_tokens, completion_tokens, total_tokens,
            assistant_id, retrieval_used, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            log_id,
            workspace_id,
            api_key_id,
            endpoint,
            method,
            model_used,
            origin,
            status_code,
            latency_ms,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            assistant_id,
            int(retrieval_used),
            error_code,
            error_message,
        ),
    )
    await db.commit()
    return log_id
