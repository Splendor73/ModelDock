from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.api_keys import create_api_key, list_api_keys, revoke_api_key
from app.services.workspace import get_workspace_id

router = APIRouter(prefix="/keys", tags=["api-keys"])


class CreateKeyRequest(BaseModel):
    label: str


@router.post("")
async def create_key(req: CreateKeyRequest):
    workspace_id = await get_workspace_id()
    result = await create_api_key(workspace_id, req.label)
    return result


@router.get("")
async def list_keys():
    workspace_id = await get_workspace_id()
    keys = await list_api_keys(workspace_id)
    return {"keys": keys}


@router.delete("/{key_id}")
async def revoke_key(key_id: str):
    workspace_id = await get_workspace_id()
    success = await revoke_api_key(key_id, workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Key not found or already revoked")
    return {"status": "revoked"}
