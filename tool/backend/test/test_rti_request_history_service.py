# test/test_rti_request_history_service.py
import uuid
import pytest
from unittest.mock import MagicMock
from sqlalchemy.exc import OperationalError
from sqlmodel import select, Session, create_engine, SQLModel
from datetime import datetime, timezone, timedelta

from src.services.rti_request_history_service import RTIRequestHistoryService
from src.models.table_schemas.table_schemas import (
    RTIRequest, RTIStatusHistories, RTIDirection, RTIStatus, Sender, Receiver
)
from src.models.response_models.rti_request_histories import (
    RTIRequestHistoryResponse, RTIRequestHistoryListResponse
)
from src.core.exceptions import (
    InternalServerException, BadRequestException, NotFoundException
)

def create_test_rti_request(session: Session):
    """Helper to seed an RTIRequest since rti_request_db fixture doesn't seed one."""
    sender = session.exec(select(Sender)).first()
    receiver = session.exec(select(Receiver)).first()
    rti_request = RTIRequest(
        id=uuid.uuid4(),
        title="Test RTI Request",
        sender_id=sender.id,
        receiver_id=receiver.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(rti_request)
    session.commit()
    session.refresh(rti_request)
    return rti_request

# test get rti request histories
@pytest.mark.asyncio
async def test_get_rti_request_histories_success(rti_request_db, make_file_service):
    """Happy path: Fetches paginated history records for a valid RTI Request."""
    # 1. Setup - Seed RTI Request and Status
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    # 2. Add history records (3 records)
    now = datetime.now(timezone.utc)
    histories = [
        RTIStatusHistories(
            id=uuid.uuid4(),
            rti_request_id=rti_request.id,
            status_id=status.id,
            direction=RTIDirection.sent,
            description=f"History {i}",
            entry_time=now + timedelta(minutes=i),
            files=[f"file{i}.pdf"]
        ) for i in range(3)
    ]
    rti_request_db.add_all(histories)
    rti_request_db.commit()
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    # 3. Fetch with page_size=2
    response = service.get_rti_request_histories(rti_request_id=rti_request.id, page=1, page_size=2)
    
    # 4. Assertions
    assert isinstance(response, RTIRequestHistoryListResponse)
    assert len(response.data) == 2
    assert response.pagination.total_items == 3
    assert response.pagination.total_pages == 2
    assert response.data[0].description == "History 2"
    assert response.data[1].description == "History 1"
    assert isinstance(response.data[0], RTIRequestHistoryResponse)

@pytest.mark.asyncio
async def test_get_rti_request_histories_not_found(rti_request_db, make_file_service):
    """NotFoundException raised when RTI Request ID doesn't exist."""
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(NotFoundException) as exc:
        service.get_rti_request_histories(rti_request_id=uuid.uuid4())
    assert "not found" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_histories_invalid_uuid(rti_request_db, make_file_service):
    """BadRequestException raised for invalid UUID format."""
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(BadRequestException) as exc:
        service.get_rti_request_histories(rti_request_id="not-a-uuid")
    assert "Invalid UUID format" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_histories_empty(rti_request_db, make_file_service):
    """Returns empty list and zero total items when no history exists for a valid request."""
    # Seed a new request without history
    rti_request = create_test_rti_request(rti_request_db)
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    response = service.get_rti_request_histories(rti_request_id=rti_request.id)
    
    assert response.data == []
    assert response.pagination.total_items == 0

@pytest.mark.asyncio
async def test_get_rti_request_histories_internal_error(rti_request_db, monkeypatch, make_file_service):
    """InternalServerException raised on database failure during retrieval."""
    rti_request = create_test_rti_request(rti_request_db)
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    # Mock session.exec to raise an exception
    def fake_exec(*args, **kwargs):
        raise OperationalError("Fake DB failure", None, None)
    
    monkeypatch.setattr(rti_request_db, "exec", fake_exec)
    
    with pytest.raises(InternalServerException) as exc:
        service.get_rti_request_histories(rti_request_id=rti_request.id)
    assert "Failed to fetch RTI request histories" in str(exc.value)
