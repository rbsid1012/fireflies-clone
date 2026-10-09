from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorOut(BaseModel):
    detail: str
    code: str


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int


ERROR_RESPONSES = {
    404: {"model": ErrorOut, "description": "Resource not found"},
    422: {"model": ErrorOut, "description": "Validation error"},
}
