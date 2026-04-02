import uuid

from fastapi import APIRouter

from app.core.database import get_db
from app.services.ollama import list_ollama_models
from app.services.workspace import get_workspace_id

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def get_models():
    workspace_id = await get_workspace_id()
    db = await get_db()
    rows = []
    async with db.execute(
        "SELECT * FROM model_configs WHERE workspace_id = ? ORDER BY ollama_name",
        (workspace_id,),
    ) as cursor:
        async for row in cursor:
            rows.append(dict(row))
    return {"models": rows}


@router.post("/sync")
async def sync_models():
    workspace_id = await get_workspace_id()
    db = await get_db()
    ollama_models = await list_ollama_models()

    synced = []
    for m in ollama_models:
        name = m.get("name", "")
        size = m.get("size", 0)
        size_str = f"{size / 1e9:.1f} GB" if size > 0 else "unknown"

        is_embed = "embed" in name.lower()

        existing = None
        async with db.execute(
            "SELECT id FROM model_configs WHERE workspace_id = ? AND ollama_name = ?",
            (workspace_id, name),
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            await db.execute(
                """UPDATE model_configs
                   SET display_name = ?, can_embed = ?, model_size = ?, synced_at = datetime('now')
                   WHERE id = ?""",
                (name, int(is_embed), size_str, existing["id"]),
            )
            synced.append(existing["id"])
        else:
            model_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO model_configs
                   (id, workspace_id, ollama_name, display_name, can_chat, can_embed, model_size)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (model_id, workspace_id, name, name, int(not is_embed), int(is_embed), size_str),
            )
            synced.append(model_id)

    await db.commit()
    return {"synced": len(synced)}


@router.post("/{model_id}/set-default-chat")
async def set_default_chat(model_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()
    await db.execute(
        "UPDATE model_configs SET is_default_chat = 0 WHERE workspace_id = ?",
        (workspace_id,),
    )
    await db.execute(
        "UPDATE model_configs SET is_default_chat = 1 WHERE id = ? AND workspace_id = ?",
        (model_id, workspace_id),
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/{model_id}/set-default-embed")
async def set_default_embed(model_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()
    await db.execute(
        "UPDATE model_configs SET is_default_embed = 0 WHERE workspace_id = ?",
        (workspace_id,),
    )
    await db.execute(
        "UPDATE model_configs SET is_default_embed = 1 WHERE id = ? AND workspace_id = ?",
        (model_id, workspace_id),
    )
    await db.commit()
    return {"status": "ok"}
