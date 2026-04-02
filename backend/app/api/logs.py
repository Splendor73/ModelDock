from fastapi import APIRouter, HTTPException

from app.core.database import get_db
from app.services.workspace import get_workspace_id

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(
    endpoint: str | None = None,
    model: str | None = None,
    origin: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    workspace_id = await get_workspace_id()
    db = await get_db()

    where_clauses = ["workspace_id = ?"]
    params: list = [workspace_id]

    if endpoint:
        where_clauses.append("endpoint = ?")
        params.append(endpoint)
    if model:
        where_clauses.append("model_used = ?")
        params.append(model)
    if origin:
        where_clauses.append("origin = ?")
        params.append(origin)
    if status == "success":
        where_clauses.append("status_code >= 200 AND status_code < 300")
    elif status == "error":
        where_clauses.append("status_code >= 400")

    where_sql = " AND ".join(where_clauses)

    count = 0
    async with db.execute(
        f"SELECT COUNT(*) FROM request_logs WHERE {where_sql}", params
    ) as cursor:
        row = await cursor.fetchone()
        count = row[0] if row else 0

    rows = []
    async with db.execute(
        f"""SELECT * FROM request_logs
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?""",
        params + [limit, offset],
    ) as cursor:
        async for row in cursor:
            rows.append(dict(row))

    return {"logs": rows, "total": count, "limit": limit, "offset": offset}


@router.get("/{log_id}")
async def get_log(log_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()
    async with db.execute(
        "SELECT * FROM request_logs WHERE id = ? AND workspace_id = ?",
        (log_id, workspace_id),
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return dict(row)


@router.get("/stats/overview")
async def get_stats():
    workspace_id = await get_workspace_id()
    db = await get_db()

    stats = {}

    async with db.execute(
        "SELECT COUNT(*) FROM request_logs WHERE workspace_id = ?",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["total_requests"] = row[0] if row else 0

    async with db.execute(
        """SELECT COUNT(*) FROM request_logs
           WHERE workspace_id = ? AND created_at >= datetime('now', '-1 day')""",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["requests_today"] = row[0] if row else 0

    async with db.execute(
        """SELECT AVG(latency_ms) FROM request_logs
           WHERE workspace_id = ? AND created_at >= datetime('now', '-1 day') AND latency_ms IS NOT NULL""",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["avg_latency_24h"] = round(row[0], 1) if row and row[0] else 0

    async with db.execute(
        """SELECT COUNT(*) FROM request_logs
           WHERE workspace_id = ? AND status_code >= 400 AND created_at >= datetime('now', '-1 day')""",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        errors = row[0] if row else 0
        total_today = stats["requests_today"] or 1
        stats["error_rate_24h"] = round(errors / total_today * 100, 1)

    async with db.execute(
        "SELECT COUNT(*) FROM api_keys WHERE workspace_id = ? AND revoked = 0",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["active_keys"] = row[0] if row else 0

    async with db.execute(
        "SELECT COUNT(*) FROM model_configs WHERE workspace_id = ?",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["models_available"] = row[0] if row else 0

    async with db.execute(
        "SELECT COUNT(*) FROM assistants WHERE workspace_id = ?",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["assistants_count"] = row[0] if row else 0

    async with db.execute(
        """SELECT COUNT(*) FROM documents d
           JOIN assistants a ON d.assistant_id = a.id
           WHERE a.workspace_id = ? AND d.status = 'indexed'""",
        (workspace_id,),
    ) as cursor:
        row = await cursor.fetchone()
        stats["documents_indexed"] = row[0] if row else 0

    return stats
