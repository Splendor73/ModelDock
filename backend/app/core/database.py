import aiosqlite

from app.core.config import settings

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> None:
    global _db
    settings.ensure_dirs()
    _db = await aiosqlite.connect(str(settings.db_path))
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")
    await _run_migrations(_db)


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


async def _run_migrations(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.commit()

    applied = set()
    async with db.execute("SELECT name FROM _migrations") as cursor:
        async for row in cursor:
            applied.add(row[0])

    for name, sql in MIGRATIONS:
        if name not in applied:
            await db.executescript(sql)
            await db.execute("INSERT INTO _migrations (name) VALUES (?)", (name,))
            await db.commit()


MIGRATIONS: list[tuple[str, str]] = [
    (
        "001_initial_schema",
        """
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'My Workspace',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            label TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'full',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_used_at TEXT,
            revoked INTEGER NOT NULL DEFAULT 0,
            revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
            ON api_keys(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix
            ON api_keys(key_prefix);

        CREATE TABLE IF NOT EXISTS model_configs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            ollama_name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            can_chat INTEGER NOT NULL DEFAULT 1,
            can_embed INTEGER NOT NULL DEFAULT 0,
            is_default_chat INTEGER NOT NULL DEFAULT 0,
            is_default_embed INTEGER NOT NULL DEFAULT 0,
            context_length INTEGER,
            model_size TEXT,
            synced_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_model_configs_workspace
            ON model_configs(workspace_id);

        CREATE TABLE IF NOT EXISTS assistants (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            name TEXT NOT NULL,
            description TEXT,
            system_prompt TEXT NOT NULL DEFAULT 'You are a helpful assistant. Answer questions based only on the provided context. If the context does not contain enough information, say so. Always cite your sources.',
            model_id TEXT REFERENCES model_configs(id),
            embedding_model_id TEXT REFERENCES model_configs(id),
            retrieval_top_k INTEGER NOT NULL DEFAULT 5,
            similarity_threshold REAL NOT NULL DEFAULT 0.7,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_assistants_workspace
            ON assistants(workspace_id);

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
            original_filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            indexed_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_documents_assistant
            ON documents(assistant_id);
        CREATE INDEX IF NOT EXISTS idx_documents_status
            ON documents(status);

        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            token_count INTEGER NOT NULL DEFAULT 0,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_document
            ON chunks(document_id);

        CREATE TABLE IF NOT EXISTS request_logs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            api_key_id TEXT,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            model_used TEXT,
            origin TEXT NOT NULL DEFAULT 'local',
            status_code INTEGER NOT NULL,
            latency_ms INTEGER,
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            total_tokens INTEGER,
            assistant_id TEXT,
            retrieval_used INTEGER NOT NULL DEFAULT 0,
            error_code TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_request_logs_workspace
            ON request_logs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_request_logs_created
            ON request_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint
            ON request_logs(endpoint);
        """,
    ),
]
