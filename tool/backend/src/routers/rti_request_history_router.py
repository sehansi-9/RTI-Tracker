from uuid import UUID
from typing import Annotated, List, Optional
from datetime import datetime
from fastapi import APIRouter, Query, Depends, Path, Form, UploadFile, File

from src.models import (
    User, 
    UserRole, 
    RTIRequestHistoryListResponse, 
    RTIRequestHistoryResponse,
    RTIRequestHistoryRequest,
    RTIDirection
)
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

@router.post("/rti_requests/{id}/histories", response_model=RTIRequestHistoryResponse)
async def create_rti_request_history_endpoint(
    id: Annotated[UUID, Path(title="ID of the RTI Request")],
    status_id: Annotated[UUID, Form(alias="statusId", description="ID of the RTI Status")],
    direction: Annotated[RTIDirection, Form(description="Direction of the RTI Status History (sent / received)")],
    entry_time: Annotated[Optional[datetime], Form(alias="entryTime", description="Entry time for the RTI Status History")] = None,
    exit_time: Annotated[Optional[datetime], Form(alias="exitTime", description="Exit time for the RTI Status History")] = None,
    description: Annotated[Optional[str], Form(description="Detailed description of the RTI Status History")] = None,
    files: list[UploadFile | str] = File(None, description="List of files for the RTI Status History (pdf only)"),
    service: RTIRequestHistoryService = Depends(get_rti_request_history_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER])),
):
    # Filter out empty strings
    actual_files = [f for f in (files or []) if not isinstance(f, str)]

    request_data = RTIRequestHistoryRequest(
        statusId=status_id,
        direction=direction,
        entryTime=entry_time,
        exitTime=exit_time,
        description=description,
        files=actual_files
    )
    return await service.create_rti_request_history(
        rti_request_id=id,
        request_data=request_data
    )

