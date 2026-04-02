from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_db, init_db
from app.api.health import router as health_router
from app.api.keys import router as keys_router
from app.api.models import router as models_router
from app.api.openai_compat import router as openai_router
from app.api.assistants import router as assistants_router
from app.api.documents import router as documents_router
from app.api.logs import router as logs_router
from app.api.runtime import router as runtime_router
from app.api.settings import router as settings_router
from app.services.workspace import ensure_default_workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.load_local_settings()
    await init_db()
    await ensure_default_workspace()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(keys_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(assistants_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(runtime_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(openai_router, prefix="/v1")
