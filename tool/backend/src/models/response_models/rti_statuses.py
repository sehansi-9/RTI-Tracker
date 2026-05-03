from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Sequence
from src.models import PaginationModel

class RTIStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    # attributes
    id: UUID = Field(
        ...,
        json_schema_extra={"example":"123e4567-e89b-12d3-a456-426614174000"},
        description="Unique identifier for the status",
    )
    name: str = Field(..., json_schema_extra={"example":"Delivery"}, description="Name of the status")
    created_at: datetime = Field(
        ...,
        serialization_alias="createdAt",
        json_schema_extra={"example":"2026-03-31T09:00:00Z"},
        description="ISO 8601 timestamp of when the status was created",
    )
    updated_at: datetime = Field(
        ...,
        serialization_alias="updatedAt",
        json_schema_extra={"example":"2026-03-31T09:00:00Z"},
        description="ISO 8601 timestamp of when the status was last updated",
    )
class RTIStatusListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    # attributes
    data: Sequence[RTIStatusResponse] = Field([], description="List of statuses.")
    pagination: PaginationModel = Field(..., description="Pagination metadata.")

class RTIStatusShortResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: UUID = Field(..., description="Unique identifier for the RTI Status")
    name: str = Field(..., description="Name of the RTI Status")
