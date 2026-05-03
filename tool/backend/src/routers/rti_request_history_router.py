from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Query, Depends, Path
from src.models import User, UserRole, RTIRequestHistoryListResponse
from src.dependencies import RoleChecker
from src.repositories.db import SessionDep
from src.services import GithubFileService, RTIRequestHistoryService

router = APIRouter(prefix="/api/v1", tags=["RTI-Requests"])

def get_file_service() -> GithubFileService:
    return GithubFileService()

def get_rti_request_history_service(
    session: SessionDep,
    file_service: GithubFileService = Depends(get_file_service),
) -> RTIRequestHistoryService:
    return RTIRequestHistoryService(session, file_service)

@router.get("/rti_requests/{id}/histories", response_model=RTIRequestHistoryListResponse)
async def get_rti_request_histories_endpoint(
    id: Annotated[UUID, Path(title="ID of the RTI Request")],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, alias="pageSize", description="Page size"),
    service: RTIRequestHistoryService = Depends(get_rti_request_history_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER])),
):
    return service.get_rti_request_histories(
        rti_request_id=id,
        page=page,
        page_size=page_size,
    )

    