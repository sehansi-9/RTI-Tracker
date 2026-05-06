from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from src.models.common.common import PaginationModel
from src.models.table_schemas import RTIDirection
from .rti_statuses import RTIStatusShortResponse


class RTIRequestHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: UUID = Field(..., description="Unique identifier for the RTI Status History")
    rti_request_id: UUID = Field(
        ...,
        serialization_alias="rtiRequestId",
        description="Unique identifier for the associated RTI Request",
    )
    rti_status: RTIStatusShortResponse = Field(
        ...,
        serialization_alias="rtiStatus",
        description="RTI Status object for this history entry",
    )
    direction: RTIDirection = Field(..., description="Direction of the RTI Status History (sent / received)")
    description: Optional[str] = Field(None, description="Description for this history entry")
    entry_time: datetime = Field(
        ...,
        serialization_alias="entryTime",
        description="ISO 8601 timestamp when this status was entered",
    )
    exit_time: Optional[datetime] = Field(
        None,
        serialization_alias="exitTime",
        description="ISO 8601 timestamp when this status was exited",
    )
    files: List[str] = Field([], description="List of file URLs attached to this history entry")
    created_at: datetime = Field(
        ...,
        serialization_alias="createdAt",
        description="ISO 8601 timestamp of when the history record was created",
    )
    updated_at: datetime = Field(
        ...,
        serialization_alias="updatedAt",
        description="ISO 8601 timestamp of when the history record was last updated",
    )


class RTIRequestHistoryListResponse(BaseModel):
    data: List[RTIRequestHistoryResponse] = Field(
        [], description="List of RTI Request History records"
    )
    pagination: PaginationModel = Field(..., description="Pagination metadata")
