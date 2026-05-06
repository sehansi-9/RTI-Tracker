from pydantic import BaseModel, ConfigDict, Field

class PaginationModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    # attributes
    page: int = Field(1, ge=1, description="Current page number (1-indexed)")
    page_size: int = Field(10, ge=1, serialization_alias="pageSize", le=100, description="Number of items per page")
    total_items: int = Field(0, ge=0, serialization_alias="totalItems", description="Total number of items available")
    total_pages: int = Field(0, ge=0, serialization_alias="totalPages", description="Total number of pages based on pageSize")
