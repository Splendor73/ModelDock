import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.services.workspace import get_workspace_id

router = APIRouter(prefix="/assistants", tags=["assistants"])


class CreateAssistantRequest(BaseModel):
    name: str
    description: str | None = None
    system_prompt: str | None = None
    model_id: str | None = None
    embedding_model_id: str | None = None
    retrieval_top_k: int = 5
    similarity_threshold: float = 0.7


class UpdateAssistantRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model_id: str | None = None
    embedding_model_id: str | None = None
    retrieval_top_k: int | None = None
    similarity_threshold: float | None = None


@router.post("")
async def create_assistant(req: CreateAssistantRequest):
    workspace_id = await get_workspace_id()
    db = await get_db()
    assistant_id = str(uuid.uuid4())

    await db.execute(
        """INSERT INTO assistants
           (id, workspace_id, name, description, system_prompt, model_id,
            embedding_model_id, retrieval_top_k, similarity_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            assistant_id,
            workspace_id,
            req.name,
            req.description,
            req.system_prompt or "You are a helpful assistant. Answer questions based only on the provided context. If the context does not contain enough information, say so. Always cite your sources.",
            req.model_id,
            req.embedding_model_id,
            req.retrieval_top_k,
            req.similarity_threshold,
        ),
    )
    await db.commit()

    return {"id": assistant_id, "name": req.name, "status": "created"}


@router.get("")
async def list_assistants():
    workspace_id = await get_workspace_id()
    db = await get_db()
    rows = []
    async with db.execute(
        """SELECT a.*, COUNT(d.id) as document_count
           FROM assistants a
           LEFT JOIN documents d ON d.assistant_id = a.id
           WHERE a.workspace_id = ?
           GROUP BY a.id
           ORDER BY a.created_at DESC""",
        (workspace_id,),
    ) as cursor:
        async for row in cursor:
            rows.append(dict(row))
    return {"assistants": rows}


@router.get("/{assistant_id}")
async def get_assistant(assistant_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()
    async with db.execute(
        """SELECT a.*, COUNT(d.id) as document_count
           FROM assistants a
           LEFT JOIN documents d ON d.assistant_id = a.id
           WHERE a.id = ? AND a.workspace_id = ?
           GROUP BY a.id""",
        (assistant_id, workspace_id),
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return dict(row)


@router.put("/{assistant_id}")
async def update_assistant(assistant_id: str, req: UpdateAssistantRequest):
    workspace_id = await get_workspace_id()
    db = await get_db()

    updates = []
    params = []
    for field, value in req.model_dump(exclude_none=True).items():
        updates.append(f"{field} = ?")
        params.append(value)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates.append("updated_at = datetime('now')")
    params.extend([assistant_id, workspace_id])

    await db.execute(
        f"UPDATE assistants SET {', '.join(updates)} WHERE id = ? AND workspace_id = ?",
        params,
    )
    await db.commit()
    return {"status": "updated"}


@router.delete("/{assistant_id}")
async def delete_assistant(assistant_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()
    result = await db.execute(
        "DELETE FROM assistants WHERE id = ? AND workspace_id = ?",
        (assistant_id, workspace_id),
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return {"status": "deleted"}
