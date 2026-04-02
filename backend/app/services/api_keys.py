import secrets
import uuid

import bcrypt

from app.core.config import settings
from app.core.database import get_db


def generate_api_key() -> tuple[str, str, str]:
    """Returns (full_key, key_hash, key_prefix)."""
    random_part = secrets.token_urlsafe(24)[:32]
    full_key = f"{settings.api_key_prefix}{random_part}"
    key_hash = bcrypt.hashpw(full_key.encode(), bcrypt.gensalt(rounds=settings.bcrypt_cost)).decode()
    key_prefix = full_key[:12]
    return full_key, key_hash, key_prefix


async def create_api_key(workspace_id: str, label: str) -> dict:
    db = await get_db()
    key_id = str(uuid.uuid4())
    full_key, key_hash, key_prefix = generate_api_key()

    await db.execute(
        """INSERT INTO api_keys (id, workspace_id, label, key_hash, key_prefix, scope)
           VALUES (?, ?, ?, ?, ?, 'full')""",
        (key_id, workspace_id, label, key_hash, key_prefix),
    )
    await db.commit()

    return {
        "id": key_id,
        "label": label,
        "key": full_key,
        "key_prefix": key_prefix,
        "scope": "full",
    }


async def validate_api_key(raw_key: str) -> dict | None:
    db = await get_db()
    prefix = raw_key[:12]
    async with db.execute(
        "SELECT id, workspace_id, label, key_hash, scope, revoked FROM api_keys WHERE key_prefix = ?",
        (prefix,),
    ) as cursor:
        async for row in cursor:
            if row["revoked"]:
                continue
            if bcrypt.checkpw(raw_key.encode(), row["key_hash"].encode()):
                await db.execute(
                    "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
                    (row["id"],),
                )
                await db.commit()
                return {
                    "id": row["id"],
                    "workspace_id": row["workspace_id"],
                    "label": row["label"],
                    "scope": row["scope"],
                }
    return None


async def list_api_keys(workspace_id: str) -> list[dict]:
    db = await get_db()
    rows = []
    async with db.execute(
        """SELECT id, label, key_prefix, scope, created_at, last_used_at, revoked, revoked_at
           FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC""",
        (workspace_id,),
    ) as cursor:
        async for row in cursor:
            rows.append(dict(row))
    return rows


async def revoke_api_key(key_id: str, workspace_id: str) -> bool:
    db = await get_db()
    result = await db.execute(
        """UPDATE api_keys SET revoked = 1, revoked_at = datetime('now')
           WHERE id = ? AND workspace_id = ? AND revoked = 0""",
        (key_id, workspace_id),
    )
    await db.commit()
    return result.rowcount > 0
