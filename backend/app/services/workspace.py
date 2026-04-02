import uuid

from app.core.database import get_db

DEFAULT_WORKSPACE_ID = "default"


async def ensure_default_workspace() -> None:
    db = await get_db()
    async with db.execute(
        "SELECT id FROM workspaces WHERE id = ?", (DEFAULT_WORKSPACE_ID,)
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        await db.execute(
            "INSERT INTO workspaces (id, name) VALUES (?, ?)",
            (DEFAULT_WORKSPACE_ID, "My Workspace"),
        )
        await db.commit()


async def get_workspace_id() -> str:
    return DEFAULT_WORKSPACE_ID
