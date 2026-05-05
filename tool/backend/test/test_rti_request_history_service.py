# test/test_rti_request_history_service.py
import uuid
import pytest
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.exc import OperationalError, IntegrityError
from sqlmodel import select, Session, create_engine, SQLModel
from datetime import datetime, timezone, timedelta

from src.services.rti_request_history_service import RTIRequestHistoryService
from src.models.table_schemas.table_schemas import (
    RTIRequest, RTIStatusHistory, RTIDirection, RTIStatus, Sender, Receiver
)
from src.models.response_models.rti_request_histories import (
    RTIRequestHistoryResponse, RTIRequestHistoryListResponse
)
from src.models.request_models.rti_request_histories import (
    RTIRequestHistoryRequest, 
    RTIRequestHistoryUpdateRequest
)
from src.core.exceptions import (
    InternalServerException, BadRequestException, NotFoundException, ConflictException
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
        RTIStatusHistory(
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
    response = service.get_rti_request_histories_by_id(rti_request_id=rti_request.id, page=1, page_size=2)
    
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
        service.get_rti_request_histories_by_id(rti_request_id=uuid.uuid4())
    assert "not found" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_histories_invalid_uuid(rti_request_db, make_file_service):
    """BadRequestException raised for invalid UUID format."""
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(BadRequestException) as exc:
        service.get_rti_request_histories_by_id(rti_request_id="not-a-uuid")
    assert "Invalid UUID format" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_histories_empty(rti_request_db, make_file_service):
    """Returns empty list and zero total items when no history exists for a valid request."""
    # Seed a new request without history
    rti_request = create_test_rti_request(rti_request_db)
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    response = service.get_rti_request_histories_by_id(rti_request_id=rti_request.id)
    
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
        service.get_rti_request_histories_by_id(rti_request_id=rti_request.id)
    assert "Failed to fetch RTI request histories" in str(exc.value)


# test create rti request history
@pytest.mark.asyncio
async def test_create_rti_request_history_success(rti_request_db, make_file_service, make_upload_file):
    """Happy path: RTI Request History is created with files, entry_time and exit_time."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    fs = make_file_service(relative_path="rti-requests/hist/123.pdf")
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    now = datetime.now(timezone.utc)
    entry_time = now - timedelta(hours=1)
    exit_time = now
    
    files = [make_upload_file(filename="doc1.pdf"), make_upload_file(filename="doc2.pdf")]
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.received,
        description="Response received",
        entryTime=entry_time,
        exitTime=exit_time,
        files=files
    )
    
    result = await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    
    assert isinstance(result, RTIRequestHistoryResponse)
    assert result.description == "Response received"
    assert result.direction == RTIDirection.received
    assert result.rti_status.id == status.id
    assert len(result.files) == 2
    
    # Normalize datetimes for comparison
    assert result.entry_time.replace(tzinfo=timezone.utc) == entry_time.replace(tzinfo=timezone.utc)
    assert result.exit_time.replace(tzinfo=timezone.utc) == exit_time.replace(tzinfo=timezone.utc)
    
    # Verify file service was called twice
    assert fs.create_file.call_count == 2

@pytest.mark.asyncio
async def test_create_rti_request_history_request_not_found(rti_request_db, make_file_service):
    """NotFoundException raised when parent RTI Request doesn't exist."""
    status = rti_request_db.exec(select(RTIStatus)).first()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc)
    )
    
    with pytest.raises(NotFoundException) as exc:
        await service.create_rti_request_history(rti_request_id=uuid.uuid4(), request_data=request)
    assert "RTI Request" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_history_status_not_found(rti_request_db, make_file_service):
    """NotFoundException raised when provided RTI Status ID doesn't exist."""
    rti_request = create_test_rti_request(rti_request_db)
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    request = RTIRequestHistoryRequest(
        statusId=uuid.uuid4(),
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc)
    )
    
    with pytest.raises(NotFoundException) as exc:
        await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert "RTI Status" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_history_invalid_file_extension(rti_request_db, make_file_service, make_upload_file):
    """BadRequestException raised for unsupported file extensions."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    files = [make_upload_file(filename="malicious.exe")]
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc),
        files=files
    )
    
    with pytest.raises(BadRequestException) as exc:
        await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert "valid extension" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_history_db_failure_rolls_back_files(rti_request_db, monkeypatch, make_file_service, make_upload_file):
    """Verifies that uploaded files are deleted from GitHub if DB commit fails."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    fs = make_file_service(relative_path="to-be-deleted.pdf")
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    # Mock commit failure
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=Exception("DB Error")))
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc),
        files=[make_upload_file(filename="test.pdf")]
    )
    
    with pytest.raises(InternalServerException):
        await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    
    # Verify file service delete was called with the relative_path returned by create_file
    fs.delete_file.assert_called_once_with(file_path="to-be-deleted.pdf")


@pytest.mark.asyncio
async def test_create_rti_request_history_without_files(rti_request_db, make_file_service):
    """Creating history without files is successful."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc),
        files=[]
    )
    
    result = await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert result.files == []

@pytest.mark.asyncio
async def test_create_rti_request_history_default_entry_time(rti_request_db, make_file_service):
    """entry_time defaults to current time if not provided in the request."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    # Passing None for entryTime (Pydantic validator should fill it)
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=None,
        files=[]
    )
    
    result = await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert result.entry_time is not None
    assert isinstance(result.entry_time, datetime)
    # Check if it's close to now
    assert (datetime.now(timezone.utc) - result.entry_time.replace(tzinfo=timezone.utc)).total_seconds() < 5

@pytest.mark.asyncio
async def test_create_rti_request_history_integrity_error(rti_request_db, monkeypatch, make_file_service):
    """ConflictException raised on database integrity error (e.g. duplicate UUID)."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    # Mock commit to raise IntegrityError
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=IntegrityError("Conflict", None, None)))
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc),
        files=[]
    )
    
    with pytest.raises(ConflictException) as exc:
        await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert "integrity error" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_history_file_upload_failure(rti_request_db, make_file_service, make_upload_file):
    """InternalServerException raised if file service fails during upload."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    # Mock file service to raise exception on create_file
    fs = make_file_service()
    fs.create_file = AsyncMock(side_effect=Exception("Upload Failed"))
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    request = RTIRequestHistoryRequest(
        statusId=status.id,
        direction=RTIDirection.sent,
        entryTime=datetime.now(timezone.utc),
        files=[make_upload_file(filename="test.pdf")]
    )
    
    with pytest.raises(InternalServerException) as exc:
        await service.create_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    assert "Failed to create RTI request history" in str(exc.value)

@pytest.mark.asyncio
async def test_update_rti_request_history_success(rti_request_db, make_file_service):
    """Updating basic fields of a history record is successful."""
    rti_request = create_test_rti_request(rti_request_db)
    
    # Ensure at least two statuses exist
    status_list = rti_request_db.exec(select(RTIStatus)).all()
    if len(status_list) < 2:
        status2 = RTIStatus(id=uuid.uuid4(), name="Status 2", description="Second status")
        rti_request_db.add(status2)
        rti_request_db.commit()
        status_list = rti_request_db.exec(select(RTIStatus)).all()
        
    status1 = status_list[0]
    status2 = status_list[1]

    
    # Create initial history
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request.id,
        status_id=status1.id,
        direction=RTIDirection.sent,
        description="Initial",
        entry_time=datetime.now(timezone.utc)
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    new_entry_time = datetime.now(timezone.utc) + timedelta(hours=1)
    new_exit_time = datetime.now(timezone.utc) + timedelta(hours=2)
    
    request = RTIRequestHistoryUpdateRequest(
        id=history.id,
        statusId=status2.id,
        direction=RTIDirection.received,
        description="Updated",
        entryTime=new_entry_time,
        exitTime=new_exit_time
    )
    
    response = await service.update_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    
    assert response.id == history.id
    assert response.rti_status.id == status2.id
    assert response.direction == RTIDirection.received

    assert response.description == "Updated"
    assert response.entry_time.replace(tzinfo=timezone.utc).timestamp() == pytest.approx(new_entry_time.replace(tzinfo=timezone.utc).timestamp(), abs=1)
    assert response.exit_time.replace(tzinfo=timezone.utc).timestamp() == pytest.approx(new_exit_time.replace(tzinfo=timezone.utc).timestamp(), abs=1)


@pytest.mark.asyncio
async def test_update_rti_request_history_add_delete_files(rti_request_db, make_file_service, make_upload_file, monkeypatch):
    """Adding new files and deleting existing ones works correctly."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    existing_file = "rti-requests/old-file.pdf"
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc),
        files=[existing_file]
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    fs = make_file_service(relative_path="new-file.pdf")
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    request = RTIRequestHistoryUpdateRequest(
        id=history.id,
        filesToAdd=[make_upload_file(filename="test.pdf")],
        filesToDelete=[existing_file]
    )
    
    response = await service.update_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    
    # Check DB updated
    assert len(response.files) == 1
    assert "new-file.pdf" in response.files
    assert existing_file not in response.files
    
    # Check physical deletion from GitHub was called
    fs.delete_file.assert_called_with(file_path=existing_file)

@pytest.mark.asyncio
async def test_update_rti_request_history_wrong_rti_request(rti_request_db, make_file_service):
    """Attempting to update a history record via the wrong RTI Request fails."""
    rti_request1 = create_test_rti_request(rti_request_db)
    rti_request2 = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request1.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc)
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    request = RTIRequestHistoryUpdateRequest(id=history.id, description="Try to steal")
    
    with pytest.raises(BadRequestException) as exc:
        await service.update_rti_request_history(rti_request_id=rti_request2.id, request_data=request)
    assert "does not belong to RTI Request" in str(exc.value)

@pytest.mark.asyncio
async def test_update_rti_request_history_not_found(rti_request_db, make_file_service):
    """Updating a non-existent history record fails."""
    rti_request = create_test_rti_request(rti_request_db)
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    request = RTIRequestHistoryUpdateRequest(id=uuid.uuid4(), description="Missing")
    
    with pytest.raises(NotFoundException):
        await service.update_rti_request_history(rti_request_id=rti_request.id, request_data=request)

@pytest.mark.asyncio
async def test_update_rti_request_history_db_failure_rolls_back_new_files(rti_request_db, make_file_service, make_upload_file, monkeypatch):
    """If DB commit fails during update, new files are cleaned up but old files stay safe."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    existing_file = "rti-requests/stay-safe.pdf"
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc),
        files=[existing_file]
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    fs = make_file_service(relative_path="orphaned.pdf")
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    # Mock commit failure
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=Exception("DB Failure")))
    
    request = RTIRequestHistoryUpdateRequest(
        id=history.id,
        filesToAdd=[make_upload_file(filename="new.pdf")],
        filesToDelete=[existing_file]
    )
    
    with pytest.raises(InternalServerException):
        await service.update_rti_request_history(rti_request_id=rti_request.id, request_data=request)
    
    # Verify file service delete was called ONLY for the new file (using its relative_path)
    fs.delete_file.assert_called_once_with(file_path="orphaned.pdf")
    
    # Double check that delete_file was NOT called for the existing_file
    for call in fs.delete_file.call_args_list:
        assert call.kwargs['file_path'] != existing_file


@pytest.mark.asyncio
async def test_delete_rti_request_history_success(rti_request_db, make_file_service):
    """Deleting a history record successfully cleans up DB and GitHub files."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    file_path = "rti-requests/to-be-nuked.pdf"
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc),
        files=[file_path]
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    fs = make_file_service()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    await service.delete_rti_request_history(rti_request_id=rti_request.id, history_id=history.id)
    
    # Verify DB record is gone
    deleted_history = rti_request_db.get(RTIStatusHistory, history.id)
    assert deleted_history is None
    
    # Verify GitHub deletion was called
    fs.delete_file.assert_called_once_with(file_path=file_path)

@pytest.mark.asyncio
async def test_delete_rti_request_history_wrong_rti(rti_request_db, make_file_service):
    """Fails when attempting to delete a history record via the wrong RTI Request."""
    rti_request1 = create_test_rti_request(rti_request_db)
    rti_request2 = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request1.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc)
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(BadRequestException) as exc:
        await service.delete_rti_request_history(rti_request_id=rti_request2.id, history_id=history.id)
    assert "does not belong to RTI Request" in str(exc.value)

@pytest.mark.asyncio
async def test_delete_rti_request_history_not_found(rti_request_db, make_file_service):
    """Fails when deleting a non-existent history record."""
    rti_request = create_test_rti_request(rti_request_db)
    service = RTIRequestHistoryService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(NotFoundException):
        await service.delete_rti_request_history(rti_request_id=rti_request.id, history_id=uuid.uuid4())

@pytest.mark.asyncio
async def test_delete_rti_request_history_db_failure(rti_request_db, make_file_service, monkeypatch):
    """GitHub files are NOT deleted if DB record deletion fails."""
    rti_request = create_test_rti_request(rti_request_db)
    status = rti_request_db.exec(select(RTIStatus)).first()
    
    file_path = "rti-requests/safe.pdf"
    history = RTIStatusHistory(
        id=uuid.uuid4(),
        rti_request_id=rti_request.id,
        status_id=status.id,
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc),
        files=[file_path]
    )
    rti_request_db.add(history)
    rti_request_db.commit()
    
    # Mock commit failure
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=Exception("DB Failure")))
    
    fs = make_file_service()
    service = RTIRequestHistoryService(session=rti_request_db, file_service=fs)
    
    with pytest.raises(InternalServerException):
        await service.delete_rti_request_history(rti_request_id=rti_request.id, history_id=history.id)
    
    # Verify GitHub deletion was NOT called
    fs.delete_file.assert_not_called()



