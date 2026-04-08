# tests/test_auth_service.py
import pytest
from src.services.auth_service import AuthService
from src.utils import http_client
from test import MockResponse, patch_http_client_session

@pytest.mark.asyncio
async def test_introspect_token_active(patch_http_client_session):
    # Prepare fake response
    patch_http_client_session.post.return_value = MockResponse({"active": True, "sub": "user123"})

    service = AuthService()
    result = await service.introspect_token("dummy_token")

    assert result is not None
    assert result["active"] is True
    assert result["sub"] == "user123"


@pytest.mark.asyncio
async def test_introspect_token_inactive(patch_http_client_session):
    patch_http_client_session.post.return_value = MockResponse({"active": False})

    service = AuthService()
    result = await service.introspect_token("dummy_token")

    assert result is None


@pytest.mark.asyncio
async def test_introspect_token_raises_exception(patch_http_client_session):
    patch_http_client_session.post.side_effect = Exception("Network error")

    service = AuthService()
    result = await service.introspect_token("dummy_token")

    assert result is None


@pytest.mark.asyncio
async def test_get_user_info_success(patch_http_client_session):
    patch_http_client_session.get.return_value = MockResponse({"email": "test@example.com", "sub": "user123"})

    service = AuthService()
    result = await service.get_user_info("dummy_token")

    assert result is not None
    assert result["email"] == "test@example.com"
    assert result["sub"] == "user123"


@pytest.mark.asyncio
async def test_get_user_info_raises_exception(patch_http_client_session):
    patch_http_client_session.get.side_effect = Exception("Network error")

    service = AuthService()
    result = await service.get_user_info("dummy_token")

    assert result is None