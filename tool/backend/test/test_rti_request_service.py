# tests/test_rti_request_service.py
import uuid
import pytest
import re
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.exc import IntegrityError
from sqlalchemy import event
from sqlmodel import SQLModel, Session, create_engine, select
from datetime import datetime, timezone

from src.services.rti_request_service import RTIRequestService
from src.models.table_schemas.table_schemas import (
    RTIRequest, RTIStatus, RTIStatusHistories, RTIDirection, 
    Sender, Receiver, Position, Institution
)
from src.models.request_models.rti_requests import RTIRequestRequest
from src.models.response_models.rti_requests import RTIRequestResponse
from src.core.exceptions import (
    InternalServerException, BadRequestException, 
    NotFoundException, ConflictException
)

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
async def test_create_rti_request_directory_name_format(rti_request_db, make_file_service, make_rti_request_request):
    """Verifies the directory name contains title, receiver info, and UUID."""
    sender = rti_request_db.exec(select(Sender)).first()
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    fs = make_file_service()
    service = RTIRequestService(session=rti_request_db, file_service=fs)
    
    title = "A very long title that should be truncated after ten words in the folder name"
    request = make_rti_request_request(
        sender_id=sender.id,
        receiver_id=receiver.id,
        title=title
    )
    
    await service.create_rti_request(request_data=request)
    
    fs.create_file.assert_called_once()
    file_path = fs.create_file.call_args.kwargs["file_path"]
    
    # Check path format: rti-requests/TruncatedTitle - ReceiverName - UUID/UUID.ext
    assert file_path.startswith("rti-requests/")
    
    # Verify truncated title (max 10 words)
    truncated_title_part = " ".join(title.split()[:10])
    # The sanitization removes non-alphanumeric except space and dash
    expected_title_part = re.sub(r'[^a-zA-Z0-9\s\-]+', '', truncated_title_part).strip()
    assert expected_title_part in file_path
    
    # Verify receiver name part (Position Institution)
    receiver_name_part = f"{receiver.position.name} {receiver.institution.name}"
    assert receiver_name_part in file_path

@pytest.mark.asyncio
async def test_create_rti_request_invalid_file_extension(rti_request_db, make_file_service, make_rti_request_request):
    """BadRequestException raised for unsupported file extensions."""
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    request = make_rti_request_request(filename="test.exe")
    
    with pytest.raises(BadRequestException) as exc:
        await service.create_rti_request(request_data=request)
    assert "valid extension" in str(exc.value)

@pytest.mark.asyncio
async def test_create_rti_request_receiver_not_found(rti_request_db, make_file_service, make_rti_request_request):
    """BadRequestException raised when receiver does not exist."""
    sender = rti_request_db.exec(select(Sender)).first()
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    
    request = make_rti_request_request(sender_id=sender.id, receiver_id=uuid.uuid4())
    
    with pytest.raises(BadRequestException) as exc:
        await service.create_rti_request(request_data=request)
    assert "Receiver with id" in str(exc.value)

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
async def test_create_rti_request_integrity_error(rti_request_db, make_file_service, make_rti_request_request):
    """ConflictException raised on IntegrityError (e.g. Foreign Key violation)."""
    receiver = rti_request_db.exec(select(Receiver)).first()
    
    # Use a non-existent sender_id to trigger a Foreign Key violation
    non_existent_sender_id = uuid.uuid4()
    
    service = RTIRequestService(session=rti_request_db, file_service=make_file_service())
    request = make_rti_request_request(sender_id=non_existent_sender_id, receiver_id=receiver.id)
    
    with pytest.raises(ConflictException):
        await service.create_rti_request(request_data=request)


