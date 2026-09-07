"""Tag request/response schemas (docs/API.md §3)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TagItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str


class TagsResponse(BaseModel):
    tags: list[TagItem]


class TagsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tags: list[TagItem] = Field(default_factory=list, max_length=50)
