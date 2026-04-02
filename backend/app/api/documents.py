import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.core.config import settings
from app.core.database import get_db
from app.services.workspace import get_workspace_id

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    ".pdf": "pdf",
    ".md": "md",
    ".txt": "txt",
    ".docx": "docx",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/upload/{assistant_id}")
async def upload_document(assistant_id: str, file: UploadFile):
    workspace_id = await get_workspace_id()
    db = await get_db()

    async with db.execute(
        "SELECT id FROM assistants WHERE id = ? AND workspace_id = ?",
        (assistant_id, workspace_id),
    ) as cursor:
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Assistant not found")

    filename = file.filename or "untitled"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_TYPES.keys())}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    checksum = hashlib.sha256(content).hexdigest()

    doc_id = str(uuid.uuid4())
    file_dir = settings.files_dir / assistant_id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_path = file_dir / f"{doc_id}_{filename}"
    file_path.write_bytes(content)

    await db.execute(
        """INSERT INTO documents
           (id, assistant_id, original_filename, file_type, file_path,
            file_size_bytes, checksum, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')""",
        (doc_id, assistant_id, filename, ALLOWED_TYPES[ext], str(file_path), len(content), checksum),
    )
    await db.commit()

    return {
        "id": doc_id,
        "filename": filename,
        "file_type": ALLOWED_TYPES[ext],
        "size_bytes": len(content),
        "status": "pending",
    }


@router.get("/by-assistant/{assistant_id}")
async def list_documents(assistant_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()

    async with db.execute(
        "SELECT id FROM assistants WHERE id = ? AND workspace_id = ?",
        (assistant_id, workspace_id),
    ) as cursor:
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Assistant not found")

    rows = []
    async with db.execute(
        """SELECT id, original_filename, file_type, file_size_bytes, status,
                  error_message, chunk_count, created_at, indexed_at
           FROM documents WHERE assistant_id = ? ORDER BY created_at DESC""",
        (assistant_id,),
    ) as cursor:
        async for row in cursor:
            rows.append(dict(row))
    return {"documents": rows}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    workspace_id = await get_workspace_id()
    db = await get_db()

    async with db.execute(
        """SELECT d.id, d.file_path FROM documents d
           JOIN assistants a ON d.assistant_id = a.id
           WHERE d.id = ? AND a.workspace_id = ?""",
        (doc_id, workspace_id),
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(row["file_path"])
    if file_path.exists():
        file_path.unlink()

    await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    await db.commit()
    return {"status": "deleted"}
