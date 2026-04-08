# tests/conftest.py
import pytest
import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Session, create_engine
from src.models import RTITemplate
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from src.services.auth_service import AuthService
from src.utils import http_client

# MockResponse class to simulate aiohttp responses
class MockResponse:
    def __init__(self, json_data, status=200):
        self._json_data = json_data
        self.status = status

    async def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status >= 400:
            raise ClientError("HTTP error")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

# Fixture to patch http_client.session with a fake session
@pytest.fixture
def patch_http_client_session():
    """Yield a mock session and patch http_client.session"""
    fake_session = MagicMock()
    with patch.object(type(http_client), "session", new_callable=PropertyMock) as mock_session_prop:
        mock_session_prop.return_value = fake_session
        yield fake_session

# fixtures for RTI Templates
@pytest.fixture
def in_memory_db():
    """Create an in-memory SQLite DB and provide a fresh session with test data."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    
    templates = [
        RTITemplate(
            id=uuid.uuid4(),
            title="Template 1",
            description="Description 1",
            file="File content 1",
            created_at=now,
            updated_at=now,
        ),
        RTITemplate(
            id=uuid.uuid4(),
            title="Template 2",
            description="Description 2",
            file="File content 2",
            created_at=now,
            updated_at=now,
        ),
        RTITemplate(
            id=uuid.uuid4(),
            title="Template 3",
            description="Description 3",
            file="File content 3",
            created_at=now,
            updated_at=now,
        ),
    ]
    
    with Session(engine) as session:
        session.add_all(templates)
        session.commit()
        yield session