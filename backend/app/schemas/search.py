from datetime import datetime, timedelta
from pydantic import BaseModel, Field, model_validator


class LogSearchRequest(BaseModel):
    index: str = Field(..., description="Index name, e.g. prod_g2")
    source: str | None = Field(default=None, description="Service/source name (wildcards added by backend)")
    query: list[str] | None = Field(default=None, description="Search terms as list of strings (each will be quoted in SPL)")
    from_time: datetime = Field(..., description="Start time (ISO 8601)")
    to_time: datetime = Field(..., description="End time (ISO 8601)")
    max_results: int = Field(default=100, ge=1, le=1000)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.to_time <= self.from_time:
            raise ValueError("to_time must be after from_time")
        if (self.to_time - self.from_time) > timedelta(days=7):
            raise ValueError("Time range cannot exceed 7 days")
        return self


class LogSearchResponse(BaseModel):
    data: list[dict]
