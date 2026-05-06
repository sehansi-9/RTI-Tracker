from pydantic import BaseModel, Field, ConfigDict


class RTIStatusRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    # attributes
    name: str = Field(..., min_length=1, json_schema_extra={"example":"DELIVERY"}, description="Name of the status.")
