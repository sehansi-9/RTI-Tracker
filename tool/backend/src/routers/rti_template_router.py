from fastapi import APIRouter,Depends, Query
from src.services import RTITemplateService
from src.repositories.db import SessionDep
from src.models.response_models import RTITemplateListResponse
from src.models import User, UserRole
from src.dependencies import RoleChecker

router = APIRouter(prefix="/api/v1", tags=["rti-template"])

def get_rti_template_service(session: SessionDep):
    return RTITemplateService(session)

@router.get("/rti_templates", response_model=RTITemplateListResponse)
async def get_rti_templates_endpoint(
    page: int = Query(1, ge=1, description="page number"),
    page_size: int = Query(10, ge=1, le=100, description="page size"),
    service: RTITemplateService = Depends(get_rti_template_service),
    user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.USER])) #uncomment to enable authorization
    ):
    response = service.get_rti_templates(page=page, page_size=page_size)
    return response

