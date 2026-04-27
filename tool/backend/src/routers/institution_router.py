from fastapi import Path
from typing import Annotated
from src.models.request_models import InstitutionRequest
from src.services.institution_service import InstitutionService
from src.repositories.db import SessionDep
from src.models.response_models import InstitutionListResponse, InstitutionResponse
from src.dependencies import RoleChecker
from src.models import UserRole, User
from fastapi import Depends, Query
from fastapi.routing import APIRouter

router = APIRouter(prefix="/api/v1", tags=["Institutions"])

def get_institution_service(session: SessionDep):
    return InstitutionService(session)

@router.get("/institutions", response_model=InstitutionListResponse)
def get_institutions_endpoint(
    page: int = Query(1, ge=1, description="page number"),
    page_size: int = Query(10, ge=1, le=100, description="page size"),
    service: InstitutionService = Depends(get_institution_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
    ):
    response = service.get_institutions(page=page, page_size=page_size)
    return response

@router.get("/institutions/{id}", response_model=InstitutionResponse)
def get_institution_by_id_endpoint(
    id: Annotated[str, Path(title="ID of the institution")],
    service: InstitutionService = Depends(get_institution_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    response = service.get_institution_by_id(institution_id=id)
    return response

@router.post("/institutions", response_model=InstitutionResponse)
def create_institutions_endpoint(
    request: InstitutionRequest,
    service: InstitutionService = Depends(get_institution_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):  
    response = service.create_institutions(request=request)
    return response

@router.put("/rti_templates/{id}")
async def update_rti_template_endpoint(
    id: Annotated[str, Path(title="ID of the institution")],
    request: InstitutionRequest,
    service: InstitutionService = Depends(get_institution_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER]))
):
    response = service.update_institution(institution_id=id,request=request)
    return response
