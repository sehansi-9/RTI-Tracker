# tests/test_rti_template_service.py
import pytest
from sqlalchemy.exc import OperationalError
from src.services.rti_template_service import RTITemplateService
from src.core.exceptions import InternalServerException
from sqlmodel import SQLModel, Session, create_engine

@pytest.mark.asyncio
async def test_get_rti_templates_default(in_memory_db):
    service = RTITemplateService(session=in_memory_db)
    response = service.get_rti_templates()
    
    assert response.pagination.page == 1
    assert response.pagination.pageSize == 10
    assert response.pagination.totalItem == 3
    assert response.pagination.totalPages == 1
    assert len(response.data) == 3

@pytest.mark.asyncio
async def test_get_rti_templates_custom_page(in_memory_db):
    service = RTITemplateService(session=in_memory_db)
    response = service.get_rti_templates(page=2, page_size=2)
    
    assert response.pagination.page == 2
    assert response.pagination.pageSize == 2
    assert response.pagination.totalItem == 3
    assert response.pagination.totalPages == 2
    assert len(response.data) == 1  # Only one record left on page 2

@pytest.mark.asyncio
async def test_get_rti_templates_empty_db():
    """Test behavior when there are no templates in the database."""

    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        service = RTITemplateService(session=session)
        response = service.get_rti_templates()
        
        assert response.pagination.page == 1
        assert response.pagination.totalItem == 0
        assert response.pagination.totalPages == 0
        assert response.data == []

@pytest.mark.asyncio
async def test_get_rti_templates_page_out_of_bounds(in_memory_db):
    """Requesting a page beyond total pages should return empty list."""
    service = RTITemplateService(session=in_memory_db)
    response = service.get_rti_templates(page=10, page_size=2)
    
    assert response.pagination.page == 10
    assert response.data == []
    # totalPages still correctly reflects actual data
    assert response.pagination.totalPages == 2

@pytest.mark.asyncio
async def test_get_rti_templates_raises_internal_exception(monkeypatch, in_memory_db):
    """Simulate a database failure and ensure InternalServerException is raised."""
    service = RTITemplateService(session=in_memory_db)
    
    # Monkeypatch the session.exec to raise an exception
    def fake_exec(*args, **kwargs):
        raise OperationalError("Fake DB failure", None, None)
    
    monkeypatch.setattr(in_memory_db, "exec", fake_exec)
    
    with pytest.raises(InternalServerException):
        await service.get_rti_templates()