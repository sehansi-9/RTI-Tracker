import uuid
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError
from sqlmodel import select, Session, create_engine, SQLModel
from src.models.response_models import RTIStatusResponse, RTIStatusListResponse
from src.models.request_models import RTIStatusRequest
from src.core.exceptions import InternalServerException
from src.models import RTIStatus
from src.services import RTIStatusService
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from src.core.exceptions import ConflictException, NotFoundException

def _make_integrity_error(constraint_name: str):
    """Build an IntegrityError that looks like a UniqueViolation."""
    diag = MagicMock()
    diag.constraint_name = constraint_name

    orig = MagicMock()
    orig.diag = diag
    return IntegrityError(statement=None, params=None, orig=orig)

# RTIStatusRequest validation

def test_rti_status_request_strips_whitespace():
    req = RTIStatusRequest(name="  Pending  ")
    assert req.name == "Pending"


def test_rti_status_request_raises_on_missing_name():
    with pytest.raises(ValidationError) as exc_info:
        RTIStatusRequest()
    errors = exc_info.value.errors()
    assert any("name" in str(e["loc"]) for e in errors)


def test_rti_status_request_raises_on_invalid_name_type():
    with pytest.raises(ValidationError) as exc_info:
        RTIStatusRequest(name=12345)
    errors = exc_info.value.errors()
    assert errors[0]["type"] == "string_type"
    assert "name" in errors[0]["loc"]


def test_rti_status_request_raises_on_empty_name():
    with pytest.raises(ValidationError):
        RTIStatusRequest(name="")


# RTIStatusService.create_rti_status

def test_create_rti_status_returns_rti_status_response(rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    result = service.create_rti_status(rti_status_request=make_rti_status_request())

    assert isinstance(result, RTIStatusResponse)
    assert result.name == "Dispatched"
    assert isinstance(result.id, uuid.UUID)
    assert result.id is not None
    assert isinstance(result.created_at, datetime)
    assert isinstance(result.updated_at, datetime)


def test_create_rti_status_persists_to_db(rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    result = service.create_rti_status(rti_status_request=make_rti_status_request(name="Dispatched"))

    db_record = rti_status_db.exec(select(RTIStatus).where(RTIStatus.id == result.id)).first()
    assert db_record is not None
    assert db_record.name == "Dispatched"


def test_create_rti_status_response_has_timestamps(rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    result = service.create_rti_status(rti_status_request=make_rti_status_request())

    assert isinstance(result.created_at, datetime)
    assert isinstance(result.updated_at, datetime)


def test_create_rti_status_raises_internal_on_db_error(monkeypatch, rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))

    with pytest.raises(InternalServerException):
        service.create_rti_status(rti_status_request=make_rti_status_request())


def test_create_rti_status_rolls_back_on_db_error(monkeypatch, rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(InternalServerException):
        service.create_rti_status(rti_status_request=make_rti_status_request())
    rollback_mock.assert_called_once()


def test_create_rti_status_raises_conflict_on_duplicate_name(rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    # Create the first one
    service.create_rti_status(rti_status_request=make_rti_status_request(name="Duplicate Name"))

    # Try to create another one with the same name
    with pytest.raises(ConflictException) as exc_info:
        service.create_rti_status(rti_status_request=make_rti_status_request(name="Duplicate Name"))
    assert "already exists" in exc_info.value.message.lower()


def test_create_rti_status_rolls_back_on_integrity_error(monkeypatch, rti_status_db, make_rti_status_request):
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(
        rti_status_db, "commit",
        MagicMock(side_effect=_make_integrity_error("rti_statuses_name_key"))
    )
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(ConflictException):
        service.create_rti_status(rti_status_request=make_rti_status_request())
    rollback_mock.assert_called_once()


# RTIStatusService.get_rti_status_list

def test_get_rti_status_list_returns_rti_status_list_response(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list()

    assert isinstance(result, RTIStatusListResponse)


def test_get_rti_status_list_returns_all_on_first_page(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=1, page_size=10)

    assert len(result.data) == 3


def test_get_rti_status_list_items_are_rti_status_responses(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list()

    for item in result.data:
        assert isinstance(item, RTIStatusResponse)


def test_get_rti_status_list_pagination_total_items(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=1, page_size=10)

    assert result.pagination.total_items == 3


def test_get_rti_status_list_pagination_total_pages(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=1, page_size=2)

    assert result.pagination.total_pages == 2


def test_get_rti_status_list_pagination_reflects_page_and_size(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=2, page_size=2)

    assert result.pagination.page == 2
    assert result.pagination.page_size == 2


def test_get_rti_status_list_page_size_limits_results(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=1, page_size=2)

    assert len(result.data) == 2


def test_get_rti_status_list_second_page_returns_remaining(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=2, page_size=2)

    assert len(result.data) == 1


def test_get_rti_status_list_returns_most_recent_first(rti_status_db, make_rti_status_request):
    """Results are ordered by created_at DESC, so a newly created status should be at index 0."""
    service = RTIStatusService(session=rti_status_db)
    
    # Create a brand new status
    new_status_name = "Brand New Status"
    service.create_rti_status(rti_status_request=make_rti_status_request(name=new_status_name))
    
    result = service.get_rti_status_list(page=1, page_size=10)

    # The newest one should be at the top (index 0)
    assert result.data[0].name == new_status_name


def test_get_rti_status_list_out_of_range_page_returns_empty(rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_list(page=99, page_size=10)

    assert len(result.data) == 0


def test_get_rti_status_list_empty_db_returns_empty_data():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        service = RTIStatusService(session=session)
        result = service.get_rti_status_list()

    assert len(result.data) == 0
    assert result.pagination.total_items == 0
    assert result.pagination.total_pages == 0


def test_get_rti_status_list_raises_internal_on_db_error(monkeypatch, rti_status_db):
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(rti_status_db, "exec", MagicMock(side_effect=Exception("DB failure")))

    with pytest.raises(InternalServerException):
        service.get_rti_status_list()


# RTIStatusService.get_rti_status_by_id

def test_get_rti_status_by_id_returns_correct_rti_status(rti_status_db):
    existing = rti_status_db.exec(select(RTIStatus)).first()
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_by_id(rti_status_id=existing.id)

    assert isinstance(result, RTIStatusResponse)
    assert result.id == existing.id
    assert result.name == existing.name


def test_get_rti_status_by_id_returns_correct_name(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    result = service.get_rti_status_by_id(rti_status_id=pending.id)

    assert result.name == "Pending"


def test_get_rti_status_by_id_raises_not_found_for_unknown_id(rti_status_db):
    service = RTIStatusService(session=rti_status_db)

    with pytest.raises(NotFoundException) as exc_info:
        service.get_rti_status_by_id(rti_status_id=uuid.uuid4())
    assert "not found" in exc_info.value.message.lower()


def test_get_rti_status_by_id_raises_internal_on_db_error(monkeypatch, rti_status_db):
    existing = rti_status_db.exec(select(RTIStatus)).first()
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(rti_status_db, "get", MagicMock(side_effect=Exception("DB failure")))

    with pytest.raises(InternalServerException):
        service.get_rti_status_by_id(rti_status_id=existing.id)


# RTIStatusService.update_rti_status_put

def test_update_rti_status_put_replaces_name(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    result = service.update_rti_status_put(
        rti_status_id=pending.id,
        rti_status_request=RTIStatusRequest(name="Updated RTI Status"),
    )

    assert result.name == "Updated RTI Status"


def test_update_rti_status_put_persists_to_db(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    service.update_rti_status_put(
        rti_status_id=pending.id,
        rti_status_request=RTIStatusRequest(name="Persisted RTI Status"),
    )

    refreshed = rti_status_db.exec(select(RTIStatus).where(RTIStatus.id == pending.id)).first()
    assert refreshed.name == "Persisted RTI Status"


def test_update_rti_status_put_returns_rti_status_response(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    result = service.update_rti_status_put(
        rti_status_id=pending.id,
        rti_status_request=RTIStatusRequest(name="New Name"),
    )

    assert isinstance(result, RTIStatusResponse)
    assert result.name == "New Name"
    assert result.id == pending.id
    assert isinstance(result.created_at, datetime)
    assert isinstance(result.updated_at, datetime)


def test_update_rti_status_put_raises_not_found_for_unknown_id(rti_status_db):
    service = RTIStatusService(session=rti_status_db)

    with pytest.raises(NotFoundException):
        service.update_rti_status_put(
            rti_status_id=uuid.uuid4(),
            rti_status_request=RTIStatusRequest(name="Ghost"),
        )


def test_update_rti_status_put_raises_conflict_on_duplicate_name(rti_status_db):
    # Get two existing statuses from the fixture seed
    statuses = rti_status_db.exec(select(RTIStatus)).all()
    status_to_update = statuses[0]
    duplicate_name = statuses[1].name

    service = RTIStatusService(session=rti_status_db)
    
    with pytest.raises(ConflictException) as exc_info:
        service.update_rti_status_put(
            rti_status_id=status_to_update.id,
            rti_status_request=RTIStatusRequest(name=duplicate_name),
        )
    assert "already exists" in exc_info.value.message.lower()


def test_update_rti_status_put_rolls_back_on_integrity_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(
        rti_status_db, "commit",
        MagicMock(side_effect=_make_integrity_error("rti_statuses_name_key"))
    )
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(ConflictException):
        service.update_rti_status_put(
            rti_status_id=pending.id,
            rti_status_request=RTIStatusRequest(name="Delivery"),
        )
    rollback_mock.assert_called_once()


def test_update_rti_status_put_raises_internal_on_db_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))

    with pytest.raises(InternalServerException):
        service.update_rti_status_put(
            rti_status_id=pending.id,
            rti_status_request=RTIStatusRequest(name="New Name"),
        )


def test_update_rti_status_put_rolls_back_on_db_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(InternalServerException):
        service.update_rti_status_put(
            rti_status_id=pending.id,
            rti_status_request=RTIStatusRequest(name="New Name"),
        )
    rollback_mock.assert_called_once()


# RTIStatusService.delete_rti_status

def test_delete_rti_status_returns_none(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)

    result = service.delete_rti_status(rti_status_id=pending.id)

    assert result is None


def test_delete_rti_status_removes_record_from_db(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    pending_id = pending.id
    service = RTIStatusService(session=rti_status_db)
    service.delete_rti_status(rti_status_id=pending_id)

    remaining = rti_status_db.exec(select(RTIStatus).where(RTIStatus.id == pending_id)).first()
    assert remaining is None


def test_delete_rti_status_does_not_affect_other_records(rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    service.delete_rti_status(rti_status_id=pending.id)

    remaining = rti_status_db.exec(select(RTIStatus)).all()
    assert len(remaining) == 2
    names = {s.name for s in remaining}
    assert "Pending" not in names


def test_delete_rti_status_raises_not_found_for_unknown_id(rti_status_db):
    service = RTIStatusService(session=rti_status_db)

    with pytest.raises(NotFoundException) as exc_info:
        service.delete_rti_status(rti_status_id=uuid.uuid4())
    assert "not found" in exc_info.value.message.lower()


def test_delete_rti_status_raises_conflict_on_fk_integrity_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(
        rti_status_db, "commit",
        MagicMock(side_effect=_make_integrity_error("rti_status_histories_status_id_fkey"))
    )

    with pytest.raises(ConflictException) as exc_info:
        service.delete_rti_status(rti_status_id=pending.id)
    assert "Cannot delete RTI status" in exc_info.value.message


def test_delete_rti_status_rolls_back_on_integrity_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(
        rti_status_db, "commit",
        MagicMock(side_effect=_make_integrity_error("rti_status_histories_status_id_fkey"))
    )
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(ConflictException):
        service.delete_rti_status(rti_status_id=pending.id)
    rollback_mock.assert_called_once()


def test_delete_rti_status_raises_internal_on_db_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))

    with pytest.raises(InternalServerException):
        service.delete_rti_status(rti_status_id=pending.id)


def test_delete_rti_status_rolls_back_on_db_error(monkeypatch, rti_status_db):
    pending = rti_status_db.exec(select(RTIStatus).where(RTIStatus.name == "Pending")).first()
    service = RTIStatusService(session=rti_status_db)
    rollback_mock = MagicMock()
    monkeypatch.setattr(rti_status_db, "commit", MagicMock(side_effect=Exception("DB failure")))
    monkeypatch.setattr(rti_status_db, "rollback", rollback_mock)

    with pytest.raises(InternalServerException):
        service.delete_rti_status(rti_status_id=pending.id)
    rollback_mock.assert_called_once()
