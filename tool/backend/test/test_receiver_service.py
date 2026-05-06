import pytest
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy.exc import OperationalError
from src.services.receiver_service import ReceiverService
from src.models.response_models import ReceiverListResponse, ReceiverResponse
from src.core.exceptions import InternalServerException, NotFoundException, ConflictException
from sqlmodel import SQLModel, Session, create_engine, select
from src.models import Institution, Position, Receiver

def test_get_receivers_default(receiver_db):
    """Test fetching receivers with default pagination (page 1, size 10)."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers()
    
    assert isinstance(response, ReceiverListResponse)
    assert response.pagination.page == 1
    assert response.pagination.page_size == 10
    assert response.pagination.total_items == 6
    assert response.pagination.total_pages == 1
    assert len(response.data) == 6
    # verify sorting order (descending by created_at)
    # Receiver 3 (now) should be first, Receiver 1 (now - 2h) should be last
    assert response.data[0].email == "receiver3@example.com"
    assert response.data[1].email == "r3@example.com"
    assert response.data[2].email == "receiver2@example.com"

    # Verify eager loading relationships
    assert response.data[0].position is not None
    assert response.data[0].institution is not None

def test_get_receivers_custom_pagination(receiver_db):
    """Test fetching receivers with custom page and page size."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(page=2, page_size=2)
    
    assert response.pagination.page == 2
    assert response.pagination.page_size == 2
    assert response.pagination.total_items == 6
    assert response.pagination.total_pages == 3
    assert len(response.data) == 2  # Only 2 record left for page 2
    assert response.data[0].email == "receiver2@example.com"

def test_get_receivers_empty_db():
    """Test behavior when no receivers exist in the database."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        service = ReceiverService(session=session)
        response = service.get_receivers()
        
        assert response.pagination.total_items == 0
        assert response.pagination.total_pages == 0
        assert response.data == []

def test_get_receivers_db_error(monkeypatch, receiver_db):
    """Test that InternalServerException is raised when a database error occurs."""
    service = ReceiverService(session=receiver_db)
    
    # Mock the session to raise an error during execution
    def mock_exec(*args, **kwargs):
        raise OperationalError("Fake DB error", None, None)
    
    monkeypatch.setattr(receiver_db, "exec", mock_exec)
    
    with pytest.raises(InternalServerException) as excinfo:
        service.get_receivers()
    
    assert "Failed to fetch Receivers from database" in str(excinfo.value)

def test_create_receiver_success(receiver_db, make_receiver_request):
    """Test successful receiver creation."""
    # Get an existing position and institution from the DB
    pos = receiver_db.exec(select(Position)).first()
    inst = receiver_db.exec(select(Institution)).first()
    
    request = make_receiver_request(position_id=pos.id, institution_id=inst.id)
    service = ReceiverService(session=receiver_db)
    
    response = service.create_receiver(receiver_request=request)
    
    assert isinstance(response, ReceiverResponse)
    assert response.email == request.email
    assert response.address == request.address
    assert response.contact_no == request.contact_no

def test_create_receiver_conflict(receiver_db, make_receiver_request):
    """Test receiver creation with duplicate email."""
    pos = receiver_db.exec(select(Position)).first()
    inst = receiver_db.exec(select(Institution)).first()
    
    # Create first receiver
    request1 = make_receiver_request(position_id=pos.id, institution_id=inst.id, email="dup@example.com")
    service = ReceiverService(session=receiver_db)
    service.create_receiver(receiver_request=request1)
    
    # Try to create second receiver with same email but different contact number
    request2 = make_receiver_request(
        position_id=pos.id, 
        institution_id=inst.id, 
        email="dup@example.com",
        contact_no="0779999999"
    )
    
    with pytest.raises(ConflictException) as excinfo:
        service.create_receiver(receiver_request=request2)
    assert "Email already exists" in str(excinfo.value)

def test_get_receiver_by_id_success(receiver_db):
    """Test fetching a receiver by ID."""
    existing = receiver_db.exec(select(Receiver)).first()
    service = ReceiverService(session=receiver_db)
    
    response = service.get_receiver_by_id(receiver_id=existing.id)
    
    assert response.id == existing.id
    assert response.email == existing.email

def test_get_receiver_by_id_not_found(receiver_db):
    """Test fetching a non-existent receiver."""
    service = ReceiverService(session=receiver_db)
    with pytest.raises(NotFoundException) as excinfo:
        service.get_receiver_by_id(receiver_id=uuid4())
    assert "not found" in str(excinfo.value)

def test_update_receiver_success(receiver_db, make_receiver_request):
    """Test successful receiver update."""
    existing = receiver_db.exec(select(Receiver)).first()
    service = ReceiverService(session=receiver_db)
    
    request = make_receiver_request(
        position_id=existing.position_id, 
        institution_id=existing.institution_id,
        email="updated@example.com"
    )
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.id == existing.id
    assert response.email == "updated@example.com"

def test_update_receiver_not_found(receiver_db, make_receiver_request):
    """Test updating a non-existent receiver."""
    service = ReceiverService(session=receiver_db)
    request = make_receiver_request(position_id=uuid4(), institution_id=uuid4())
    
    with pytest.raises(NotFoundException) as excinfo:
        service.update_receiver(receiver_id=uuid4(), receiver_request=request)
    assert "not found" in str(excinfo.value)

def test_delete_receiver_success(receiver_db):
    """Test successful receiver deletion."""
    existing = receiver_db.exec(select(Receiver)).first()
    service = ReceiverService(session=receiver_db)
    
    service.delete_receiver(receiver_id=existing.id)
    
    # Verify it's gone
    with pytest.raises(NotFoundException):
        service.get_receiver_by_id(receiver_id=existing.id)

def test_delete_receiver_not_found(receiver_db):
    """Test deleting a non-existent receiver."""
    service = ReceiverService(session=receiver_db)
    with pytest.raises(NotFoundException) as excinfo:
        service.delete_receiver(receiver_id=uuid4())
    assert "not found" in str(excinfo.value)

def test_update_receiver_partial_email(receiver_db, make_receiver_update_request):
    """Test partial update of only the email field."""
    existing = receiver_db.exec(select(Receiver)).first()
    original_address = existing.address
    original_contact = existing.contact_no
    
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(email="partial@example.com")
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.email == "partial@example.com"
    assert response.address == original_address
    assert response.contact_no == original_contact

def test_update_receiver_partial_address(receiver_db, make_receiver_update_request):
    """Test partial update of only the address field."""
    existing = receiver_db.exec(select(Receiver)).first()
    original_email = existing.email
    
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(address="Updated partial address")
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.address == "Updated partial address"
    assert response.email == original_email

def test_update_receiver_partial_contact_no(receiver_db, make_receiver_update_request):
    """Test partial update of only the contact_no field."""
    existing = receiver_db.exec(select(Receiver)).first()
    original_email = existing.email
    
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(contact_no="0779876543")
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.contact_no == "0779876543"
    assert response.email == original_email

def test_update_receiver_partial_position(receiver_db, make_receiver_update_request):
    """Test partial update of only the position field."""
    existing = receiver_db.exec(select(Receiver)).first()
    new_pos = Position(id=uuid4(), name="New Position", created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    receiver_db.add(new_pos)
    receiver_db.commit()
    
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(position_id=new_pos.id)
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.position.id == new_pos.id
    assert response.position.name == "New Position"

def test_update_receiver_partial_institution(receiver_db, make_receiver_update_request):
    """Test partial update of only the institution field."""
    existing = receiver_db.exec(select(Receiver)).first()
    new_inst = Institution(id=uuid4(), name="New Institution", created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    receiver_db.add(new_inst)
    receiver_db.commit()
    
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(institution_id=new_inst.id)
    
    response = service.update_receiver(receiver_id=existing.id, receiver_request=request)
    
    assert response.institution.id == new_inst.id
    assert response.institution.name == "New Institution"

def test_create_receiver_invalid_position_id(receiver_db, make_receiver_request):
    """Test receiver creation with non-existent position ID."""
    inst = receiver_db.exec(select(Institution)).first()
    request = make_receiver_request(position_id=uuid4(), institution_id=inst.id)
    service = ReceiverService(session=receiver_db)
    
    with pytest.raises(ConflictException) as excinfo:
        service.create_receiver(receiver_request=request)
    assert "constraint violation" in str(excinfo.value).lower()

def test_create_receiver_invalid_institution_id(receiver_db, make_receiver_request):
    """Test receiver creation with non-existent institution ID."""
    pos = receiver_db.exec(select(Position)).first()
    request = make_receiver_request(position_id=pos.id, institution_id=uuid4())
    service = ReceiverService(session=receiver_db)
    
    with pytest.raises(ConflictException) as excinfo:
        service.create_receiver(receiver_request=request)
    assert "constraint violation" in str(excinfo.value).lower()

def test_update_receiver_invalid_position_id(receiver_db, make_receiver_update_request):
    """Test receiver update with non-existent position ID."""
    existing = receiver_db.exec(select(Receiver)).first()
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(position_id=uuid4())
    
    with pytest.raises(ConflictException) as excinfo:
        service.update_receiver(receiver_id=existing.id, receiver_request=request)
    assert "constraint violation" in str(excinfo.value).lower()

def test_update_receiver_invalid_institution_id(receiver_db, make_receiver_update_request):
    """Test receiver update with non-existent institution ID."""
    existing = receiver_db.exec(select(Receiver)).first()
    service = ReceiverService(session=receiver_db)
    request = make_receiver_update_request(institution_id=uuid4())
    
    with pytest.raises(ConflictException) as excinfo:
        service.update_receiver(receiver_id=existing.id, receiver_request=request)
    assert "constraint violation" in str(excinfo.value).lower()


def test_get_receivers_filter_by_institution_name(receiver_db):
    """Filtering by institution name returns only matching receivers."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="Ministry of Health")

    assert isinstance(response, ReceiverListResponse)
    assert response.pagination.total_items == 1
    assert response.data[0].email == "r1@example.com"
    assert response.data[0].institution.name == "Ministry of Health"


def test_get_receivers_filter_by_institution_name_partial(receiver_db):
    """Partial institution name match returns all matching receivers."""
    service = ReceiverService(session=receiver_db)
    # Both "Ministry of Health" and "Ministry of Finance" contain "Ministry"
    response = service.get_receivers(query="Ministry")

    assert response.pagination.total_items == 2
    emails = {r.email for r in response.data}
    assert emails == {"r1@example.com", "r2@example.com"}


def test_get_receivers_filter_by_position_name(receiver_db):
    """Filtering by position name returns only matching receivers."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="Director General")

    assert response.pagination.total_items == 1
    assert response.data[0].email == "r2@example.com"
    assert response.data[0].position.name == "Director General"


def test_get_receivers_filter_by_position_name_partial(receiver_db):
    """Partial position name match returns correct receivers."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="Admin")

    assert response.pagination.total_items == 1
    assert response.data[0].email == "r3@example.com"


def test_get_receivers_filter_case_insensitive_institution(receiver_db):
    """Search is case-insensitive for institution name."""
    service = ReceiverService(session=receiver_db)

    response_lower = service.get_receivers(query="ministry of health")
    response_upper = service.get_receivers(query="MINISTRY OF HEALTH")
    response_mixed = service.get_receivers(query="Ministry Of Health")

    assert response_lower.pagination.total_items == 1
    assert response_upper.pagination.total_items == 1
    assert response_mixed.pagination.total_items == 1


def test_get_receivers_filter_case_insensitive_position(receiver_db):
    """Search is case-insensitive for position name."""
    service = ReceiverService(session=receiver_db)

    response_lower = service.get_receivers(query="legal officer")
    response_upper = service.get_receivers(query="LEGAL OFFICER")

    assert response_lower.pagination.total_items == 1
    assert response_upper.pagination.total_items == 1
    assert response_lower.data[0].email == "r1@example.com"


def test_get_receivers_filter_no_match(receiver_db):
    """Query with no matches returns empty data and correct pagination."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="Nonexistent Institution XYZ")

    assert isinstance(response, ReceiverListResponse)
    assert response.pagination.total_items == 0
    assert response.pagination.total_pages == 0
    assert response.data == []


def test_get_receivers_filter_none_query_returns_all(receiver_db):
    """Passing query=None falls back to normal behaviour and returns all records."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query=None)

    assert response.pagination.total_items == 6
    assert len(response.data) == 6


def test_get_receivers_filter_empty_string_returns_all(receiver_db):
    """Passing an empty string query falls back to normal behaviour."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="")

    # empty string is falsy, so no filter should be applied
    assert response.pagination.total_items == 6


def test_get_receivers_filter_with_pagination(receiver_db):
    """Filter result count feeds correctly into pagination when paged."""
    service = ReceiverService(session=receiver_db)
    # Both Ministry records match; request page_size=1 to force two pages
    response_p1 = service.get_receivers(query="Ministry", page=1, page_size=1)
    response_p2 = service.get_receivers(query="Ministry", page=2, page_size=1)

    assert response_p1.pagination.total_items == 2
    assert response_p1.pagination.total_pages == 2
    assert len(response_p1.data) == 1

    assert response_p2.pagination.total_items == 2
    assert response_p2.pagination.total_pages == 2
    assert len(response_p2.data) == 1

    # Combined, they cover both matching receivers
    emails = {response_p1.data[0].email, response_p2.data[0].email}
    assert emails == {"r1@example.com", "r2@example.com"}


def test_get_receivers_filter_eager_loads_relationships(receiver_db):
    """Filtered results still eager-load position and institution relationships."""
    service = ReceiverService(session=receiver_db)
    response = service.get_receivers(query="Sri Lanka Police")

    assert response.pagination.total_items == 1
    result = response.data[0]
    assert result.position is not None
    assert result.institution is not None
    assert result.institution.name == "Sri Lanka Police"
