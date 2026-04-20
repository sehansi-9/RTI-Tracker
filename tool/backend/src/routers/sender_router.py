from fastapi import APIRouter, Depends
from src.services import SenderService
from src.repositories.db import SessionDep
from src.models import SenderResponse, SenderRequest

router = APIRouter(prefix="/api/v1", tags=["Senders"])

def get_sender_service(session: SessionDep):
    return SenderService(session)

@router.post("/senders", response_model=SenderResponse)
async def create_rti_templates_endpoint(
    sender_request: SenderRequest,
    service: SenderService = Depends(get_sender_service)
):
    return service.create_sender(template_request=sender_request)



