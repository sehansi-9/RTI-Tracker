# tests/test_rti_request_service.py
import uuid
import pytest
import re
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy import event
from sqlmodel import SQLModel, Session, create_engine, select
from datetime import datetime, timezone

from src.services.rti_request_service import RTIRequestService
from src.models.table_schemas.table_schemas import (
    RTIRequest, RTIStatus, RTIStatusHistories, RTIDirection, 
    Sender, Receiver, Position, Institution
)
from src.models.request_models.rti_requests import RTIRequestRequest, RTIRequestUpdateRequest
from src.models.response_models.rti_requests import RTIRequestResponse
from src.core.exceptions import (
    InternalServerException, BadRequestException, 
    NotFoundException, ConflictException
)

# test create rti request
@pytest.mark.asyncio
async def test_create_rti_request_success(rti_request_db, make_file_service, make_rti_request_request):
    """Happy path: RTI Request is created along with status history."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    fs = make_file_service(relative_path="rti-requests/dir/file.pdf")
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    request = make_rti_request_request(
        sender_id=sender.id,
        receiver_id=receiver.id,
        title="My Sample RTI Request"
    )
    
    result = await service.create_rti_request(request_data=request)
    
    assert isinstance(result, RTIRequestResponse)
    assert result.title == "My Sample RTI Request"
    assert result.sender.id == sender.id
    assert result.receiver.id == receiver.id
    
    # Check if RTIRequest record exists
    db_request = rti_request_db.exec(select(RTIRequest).where(RTIRequest.id == result.id)).first()
    assert db_request is not None
    
    # Check if RTIStatusHistories record exists
    db_history = rti_request_db.exec(select(RTIStatusHistories).where(RTIStatusHistories.rti_request_id == result.id)).first()
    assert db_history is not None
    assert db_history.direction == RTIDirection.sent
    assert db_history.files == ["rti-requests/dir/file.pdf"]
    
    # Verify file service was called
    fs.create_file.assert_called_once()

@pytest.mark.asyncio
async def test_create_rti_request_invalid_file_extension(rti_request_db, make_file_service, make_rti_request_request):
    """BadRequestException raised for unsupported file extensions."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    request = make_rti_request_request(filename="test.exe")
    
    with pytest.raises(BadRequestException) as exc:
        await service.create_rti_request(request_data=request)
    assert "valid extension" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_missing_created_status(rti_request_db, make_file_service, make_rti_request_request):
    """InternalServerException raised when 'CREATED' status is missing from DB."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    # Delete the CREATED status
    rti_request_db.exec(select(RTIStatus).where(RTIStatus.name == "CREATED")).first()
    rti_request_db.delete(rti_request_db.exec(select(RTIStatus).where(RTIStatus.name == "CREATED")).first())
    rti_request_db.commit()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    
    with pytest.raises(InternalServerException) as exc:
        await service.create_rti_request(request_data=request)
    assert "Status 'CREATED' not found" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_db_failure_rolls_back(rti_request_db, monkeypatch, make_file_service, make_rti_request_request):
    """Verifies rollback and GitHub file deletion on DB commit failure."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    relative_path = "rti-requests/fail/file.pdf"
    fs = make_file_service(relative_path=relative_path)
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Mock commit failure
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=Exception("DB Error")))
    rollback_mock = MagicMock()
    monkeypatch.setattr(rti_request_db, "rollback", rollback_mock)
    
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    
    with pytest.raises(InternalServerException):
        await service.create_rti_request(request_data=request)
    
    rollback_mock.assert_called_once()
    fs.delete_file.assert_called_once_with(file_path=relative_path)

@pytest.mark.asyncio
async def test_create_rti_request_not_found(rti_request_db, make_file_service, make_rti_request_request):
    """NotFoundException raised when a foreign key (sender/receiver) is not found."""
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    # Use a non-existent sender_id
    non_existent_sender_id = uuid.uuid4()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    request = make_rti_request_request(sender_id=non_existent_sender_id, receiver_id=receiver.id)
    
    with pytest.raises(NotFoundException):
        await service.create_rti_request(request_data=request)

@pytest.mark.asyncio
async def test_create_rti_request_without_description(rti_request_db, make_file_service, make_rti_request_request):
    """Optional description can be None without breaking the creation flow."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id, title="No Desc")
    request.description = None
    
    result = await service.create_rti_request(request_data=request)
    assert result.description is None
    assert result.title == "No Desc"

# test get rti request by id
@pytest.mark.asyncio
async def test_get_rti_request_by_id_success(rti_request_db, make_file_service, make_rti_request_request):
    """Happy path: RTI Request is retrieved by ID."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Get by ID
    result = service.get_rti_request_by_id(request_id=str(created.id))
    
    assert isinstance(result, RTIRequestResponse)
    assert result.id == created.id
    assert result.title == created.title
    assert result.description == created.description
    assert result.sender.id == sender.id
    assert result.receiver.id == receiver.id
    assert result.rti_template is None  # Since we didn't provide one
    assert result.created_at is not None
    assert result.updated_at is not None

@pytest.mark.asyncio
async def test_get_rti_request_by_id_not_found(rti_request_db, make_file_service):
    """NotFoundException raised when ID doesn't exist."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(NotFoundException) as exc:
        service.get_rti_request_by_id(request_id=str(uuid.uuid4()))
    assert "not found" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_by_id_invalid_uuid(rti_request_db, make_file_service):
    """BadRequestException raised for invalid UUID strings."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(BadRequestException) as exc:
        service.get_rti_request_by_id(request_id="invalid-uuid")
    assert "Invalid UUID format" in str(exc.value)

@pytest.mark.asyncio
async def test_get_rti_request_by_id_internal_error(rti_request_db, monkeypatch, make_file_service):
    """InternalServerException raised on database failure during retrieval."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    # Mock session.get to raise an exception
    monkeypatch.setattr(rti_request_db, "get", MagicMock(side_effect=Exception("DB breakdown")))
    
    with pytest.raises(InternalServerException) as exc:
        service.get_rti_request_by_id(request_id=str(uuid.uuid4()))
    assert "Failed to read RTI request" in str(exc.value)

# test get rti request
@pytest.mark.asyncio
async def test_get_rti_requests_success(rti_request_db, make_file_service, make_rti_request_request):
    """Verifies fetching paginated RTI Requests."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    fs = make_file_service()
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Create 3 RTI requests
    for i in range(3):
        request = make_rti_request_request(
            sender_id=sender.id,
            receiver_id=receiver.id,
            title=f"RTI Request {i}"
        )
        await service.create_rti_request(request_data=request)
    
    # Test fetching with page_size=2
    response = service.get_rti_requests(page=1, page_size=2)
    
    assert len(response.data) == 2
    assert response.pagination.totalItem == 3
    assert response.pagination.totalPages == 2
    assert response.pagination.page == 1
    assert response.pagination.pageSize == 2

@pytest.mark.asyncio
async def test_get_rti_requests_empty_db(make_file_service):
    """Test behavior when there are no requests in the database."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        service = RTIRequestService(session=session, file_service=make_file_service())
        response = service.get_rti_requests()
        
        assert response.pagination.page == 1
        assert response.pagination.totalItem == 0
        assert response.pagination.totalPages == 0
        assert response.data == []

@pytest.mark.asyncio
async def test_get_rti_requests_page_out_of_bounds(rti_request_db, make_file_service):
    """Requesting a page beyond total pages should return empty list."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    response = service.get_rti_requests(page=10, page_size=2)
    
    assert response.pagination.page == 10
    assert response.data == []

@pytest.mark.asyncio
async def test_get_rti_requests_internal_error(rti_request_db, monkeypatch, make_file_service):
    """Simulate a database failure during listing and ensure InternalServerException is raised."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    def fake_exec(*args, **kwargs):
        raise OperationalError("Fake DB failure", None, None)
    
    monkeypatch.setattr(rti_request_db, "exec", fake_exec)
    
    with pytest.raises(InternalServerException):
        service.get_rti_requests()

# test update rti request
@pytest.mark.asyncio
async def test_update_rti_request_success(rti_request_db, make_file_service, make_rti_request_request, make_rti_request_update_request):
    """Happy path: RTI Request title and description are updated."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Update title and description
    update_request = make_rti_request_update_request(id=str(created.id), title="New Title", description="New Desc")
    result = await service.update_rti_request(request_data=update_request)
    
    assert result.title == "New Title"
    assert result.description == "New Desc"

@pytest.mark.asyncio
async def test_update_rti_request_with_file_success(rti_request_db, make_file_service, make_rti_request_request, make_rti_request_update_request):
    """Updating RTI Request with a new file calls the file service's update_file."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    relative_path = "rti-requests/update/file.pdf"
    fs = make_file_service(relative_path=relative_path)
    fs.read_file = AsyncMock(return_value={"content": b"old content", "sha": "old-sha"})
    
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Update with new file
    update_request = make_rti_request_update_request(id=str(created.id), filename="updated.pdf")
    result = await service.update_rti_request(request_data=update_request)
    
    assert result.id == created.id
    fs.update_file.assert_called_once()

@pytest.mark.asyncio
async def test_update_rti_request_not_found(rti_request_db, make_file_service, make_rti_request_update_request):
    """NotFoundException raised when updating a non-existent RTI Request."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    update_request = make_rti_request_update_request(id=str(uuid.uuid4()))
    
    with pytest.raises(NotFoundException):
        await service.update_rti_request(request_data=update_request)

@pytest.mark.asyncio
async def test_update_rti_request_db_failure_rolls_back_file(rti_request_db, monkeypatch, make_file_service, make_rti_request_request, make_rti_request_update_request):
    """Verifies file rollback on GitHub when DB commit fails during update."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    old_content = b"old content"
    old_sha = "old-sha"
    new_sha = "new-sha"
    
    fs = make_file_service(relative_path="rti-requests/dummy/dummy.pdf")
    fs.read_file = AsyncMock(side_effect=[
        {"content": old_content, "sha": old_sha}, # first call (old)
        {"content": b"new content", "sha": new_sha} # second call (new) for rollback
    ])
    
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Mock DB failure
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=Exception("DB Error")))
    
    update_request = make_rti_request_update_request(id=str(created.id), filename="updated.pdf")
    
    with pytest.raises(InternalServerException):
        await service.update_rti_request(request_data=update_request)
    
    # Verify rollback call
    fs.update_file.assert_any_call(
        file_path="rti-requests/dummy/dummy.pdf",
        content=old_content,
        sha=new_sha,
        message=f"Rollback: restore previous version for {created.id}"
    )

# test delete rti request
@pytest.mark.asyncio
async def test_delete_rti_request_success(rti_request_db, make_file_service, make_rti_request_request):
    """Happy path: RTI Request, its history and files are deleted."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    fs = make_file_service()
    fs.read_file = AsyncMock(return_value={"content": b"content", "sha": "sha"})
    
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Delete it
    await service.delete_rti_request(request_id=str(created.id))
    
    # Verify DB deletion
    assert rti_request_db.get(RTIRequest, created.id) is None
    
    # Verify History deletion
    histories = rti_request_db.exec(select(RTIStatusHistories).where(RTIStatusHistories.rti_request_id == created.id)).all()
    assert len(histories) == 0
    
    # Verify GitHub deletion
    fs.delete_file.assert_called()

@pytest.mark.asyncio
async def test_delete_rti_request_not_found(rti_request_db, make_file_service):
    """NotFoundException raised when deleting non-existent RTI Request."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    with pytest.raises(NotFoundException):
        await service.delete_rti_request(request_id=str(uuid.uuid4()))

@pytest.mark.asyncio
async def test_delete_rti_request_conflict_no_file_deletion(rti_request_db, monkeypatch, make_file_service, make_rti_request_request):
    """IntegrityError during deletion prevents GitHub file deletion."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    fs = make_file_service()
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    # Create one
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Mock IntegrityError on commit
    monkeypatch.setattr(rti_request_db, "commit", MagicMock(side_effect=IntegrityError("conflict", None, None)))
    
    with pytest.raises(ConflictException):
        await service.delete_rti_request(request_id=str(created.id))
    
    # Verify delete_file was NEVER called because DB commit failed
    fs.delete_file.assert_not_called()

@pytest.mark.asyncio
async def test_delete_rti_request_blocked_by_history(rti_request_db, make_file_service, make_rti_request_request):
    """Deletion is blocked if there are multiple status history records."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    # Create one (adds first history)
    request = make_rti_request_request(sender_id=sender.id, receiver_id=receiver.id)
    created = await service.create_rti_request(request_data=request)
    
    # Add a second history record
    history2 = RTIStatusHistories(
        id=uuid.uuid4(),
        rti_request_id=created.id,
        status_id=rti_request_db.exec(select(RTIStatus)).first().id, # just use any status
        direction=RTIDirection.sent,
        entry_time=datetime.now(timezone.utc),
        files=[]
    )
    rti_request_db.add(history2)
    rti_request_db.commit()
    
    with pytest.raises(ConflictException) as exc:
        await service.delete_rti_request(request_id=str(created.id))
    assert "records beyond creation" in str(exc.value)




