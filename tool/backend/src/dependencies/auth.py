import logging
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.services import AuthService
from src.core.exceptions import UnauthorizedException, ForbiddenException
from src.models.common.auth import User, UserRole
from functools import lru_cache
from typing import List

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def get_auth_service():
    return AuthService()

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> User:
    """
    Reusable dependency to verify the opaque token and return a User object.
    Raises UnauthorizedException if the token is invalid or inactive.
    """
    if not credentials:
        logger.warning("No authentication credentials provided in request")
        raise UnauthorizedException("No authentication token provided")
    
    user_data = await auth_service.introspect_token(credentials.credentials)
    if not user_data:
        logger.warning("Token introspection failed or token is inactive")
        raise UnauthorizedException("Invalid or expired authentication token")
    
    # Fetch additional user details (email, groups/roles) from Userinfo endpoint
    user_info = await auth_service.get_user_info(credentials.credentials)
    if user_info:
        user_data.update(user_info)

    try:
        user = User.model_validate(user_data)
        logger.info(f"Successfully authenticated user: {user.id}")
        return user
    except Exception as e:
        logger.error(f"User model validation failed: {str(e)}")
        raise UnauthorizedException("Failed to process user information")

class RoleChecker:
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, user: User = Depends(get_current_user)) -> User:
        if not any(role in user.roles for role in self.allowed_roles):
            logger.warning(
                f"Permission denied for user {user.id}. "
                f"Required one of: {self.allowed_roles}, but user has: {user.roles}"
            )
            # We return a generic message to the user for security, but log the details above
            raise ForbiddenException("User does not have required permissions")
        return user
