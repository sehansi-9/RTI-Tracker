from fastapi import APIRouter, Depends
from src.services import SenderService
from src.repositories.db import SessionDep
from src.models import SenderResponse, SenderRequest

router = APIRouter(prefix="/api/v1", tags=["Senders"])

def get_sender_service(session: SessionDep):
    return SenderService(session)

@router.post("/senders", response_model=SenderResponse)
async def create_sender_endpoint(
    sender_request: SenderRequest,
    service: SenderService = Depends(get_sender_service)
):
    return service.create_sender(sender_request=sender_request)



