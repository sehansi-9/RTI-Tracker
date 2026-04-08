from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Any
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "rti-admin"
    USER = "rti-user"

class User(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True, populate_by_name=True)

    id: str = Field(..., alias="sub", description="Unique identifier for the user (Subject)")
    email: Optional[str] = Field(None, description="User's email address")
    roles: List[str] = Field(default_factory=list, description="List of roles assigned to the user")
    active: bool = Field(True, description="Whether the user's session is active")
    scope: Optional[str] = Field(None, description="Permissions scope of the token")

    @model_validator(mode='before')
    @classmethod
    def map_user_attributes(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map 'groups' to 'roles' if 'roles' is missing or empty
            # Many providers like Asgardeo use 'groups' for role-based access
            if not data.get('roles') and 'groups' in data:
                groups = data['groups']
                data['roles'] = groups if isinstance(groups, list) else [groups]

        return data
