from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


class UpdateSettingsRequest(BaseModel):
    ollama_base_url: str


@router.get("")
async def get_settings():
    return {"ollama_base_url": settings.ollama_base_url}


@router.put("")
async def update_settings(req: UpdateSettingsRequest):
    settings.ollama_base_url = req.ollama_base_url.strip()
    settings.save_local_settings()
    return {"status": "updated", "ollama_base_url": settings.ollama_base_url}
