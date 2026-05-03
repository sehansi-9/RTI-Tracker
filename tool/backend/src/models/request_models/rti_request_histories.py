from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from fastapi import UploadFile

from src.models.table_schemas.table_schemas import RTIDirection

class RTIRequestHistoryRequest(BaseModel):
    status_id: UUID = Field(..., alias="statusId", description="ID of the RTI Status")
    direction: RTIDirection = Field(..., description="Direction of the RTI Status History (sent / received)")
    description: Optional[str] = Field(None, description="Detailed description of the RTI Status History")
    entry_time: Optional[datetime] = Field(
        default=None, 
        alias="entryTime", 
        description="Entry time for the RTI Status History. Defaults to current time if not provided."
    )
    exit_time: Optional[datetime] = Field(
        default=None,
        alias="exitTime",
        description="Exit time for the RTI Status History"
    )
    files: List[UploadFile] = Field([], description="List of files for the RTI Status History (pdf only)")

    @field_validator("entry_time", mode="before")
    @classmethod
    def set_entry_time(cls, v):
        if v is None or v == "":
            return datetime.now(timezone.utc)
        return v
