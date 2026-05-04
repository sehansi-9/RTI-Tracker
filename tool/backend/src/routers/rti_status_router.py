from fastapi import APIRouter, Depends, Query, status, Path
from typing_extensions import Annotated
from src.services import RTIStatusService
from src.repositories.db import SessionDep
from src.models import RTIStatusResponse, RTIStatusRequest, RTIStatusListResponse
from src.models import User, UserRole
from src.dependencies import RoleChecker
from uuid import UUID

router = APIRouter(prefix="/api/v1", tags=["RTI Statuses"])

def get_rti_status_service(session: SessionDep):
    return RTIStatusService(session)

@router.post("/rti_statuses", response_model=RTIStatusResponse, status_code=status.HTTP_201_CREATED)
def create_rti_status_endpoint(
    rti_status_request: RTIStatusRequest,
    service: RTIStatusService = Depends(get_rti_status_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    return service.create_rti_status(rti_status_request=rti_status_request)

@router.get("/rti_statuses", response_model=RTIStatusListResponse)
def get_rti_status_list_endpoint(
    page: int = Query(1, ge=1, description="page number"),
    page_size: int = Query(10, ge=1, le=100, alias="pageSize", description="page size"),
    service: RTIStatusService = Depends(get_rti_status_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    return service.get_rti_status_list(page=page, page_size=page_size)

@router.get("/rti_statuses/{id}", response_model=RTIStatusResponse)
def get_rti_status_by_id_endpoint(
    id: Annotated[UUID, Path(title="ID of the RTI status")],
    service: RTIStatusService = Depends(get_rti_status_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    return service.get_rti_status_by_id(rti_status_id=id)

@router.put("/rti_statuses/{id}", response_model=RTIStatusResponse)
def update_rti_status_put_endpoint(
    id: Annotated[UUID, Path(title="ID of the RTI status")],
    rti_status_request: RTIStatusRequest,
    service: RTIStatusService = Depends(get_rti_status_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    return service.update_rti_status_put(rti_status_id=id, rti_status_request=rti_status_request)

@router.delete("/rti_statuses/{id}", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
def delete_rti_status_endpoint(
    id: Annotated[UUID, Path(title="ID of the RTI status")],
    service: RTIStatusService = Depends(get_rti_status_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    return service.delete_rti_status(rti_status_id=id)



