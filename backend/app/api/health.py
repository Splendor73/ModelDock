from fastapi import APIRouter

from app.core.config import settings
from app.services.ollama import get_ollama_status

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    ollama = await get_ollama_status()
    return {
        "status": "ok",
        "version": settings.version,
        "ollama": ollama,
    }
