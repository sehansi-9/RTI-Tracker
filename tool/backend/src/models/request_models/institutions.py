from pydantic import BaseModel, ConfigDict, Field

class InstitutionRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    # attributes
    name: str = Field(..., json_schema_extra={"example":"Institution X"}, description="Name of the institution.")

