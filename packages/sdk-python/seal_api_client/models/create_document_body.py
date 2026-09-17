from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateDocumentBody")


@_attrs_define
class CreateDocumentBody:
    """
    Attributes:
        title (str): Document title displayed to recipients
        storage_id (str): Storage ID returned by the Uploads API
        file_size (int): File size in bytes
        description (str | Unset):
        file_type (str | Unset):  Default: 'application/pdf'.
        page_count (int | Unset): Number of pages in the document
        deadline (datetime.datetime | Unset): Signing deadline — recipients cannot sign after this date
    """

    title: str
    storage_id: str
    file_size: int
    description: str | Unset = UNSET
    file_type: str | Unset = "application/pdf"
    page_count: int | Unset = UNSET
    deadline: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        title = self.title

        storage_id = self.storage_id

        file_size = self.file_size

        description = self.description

        file_type = self.file_type

        page_count = self.page_count

        deadline: str | Unset = UNSET
        if not isinstance(self.deadline, Unset):
            deadline = self.deadline.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "title": title,
                "storage_id": storage_id,
                "file_size": file_size,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if file_type is not UNSET:
            field_dict["file_type"] = file_type
        if page_count is not UNSET:
            field_dict["page_count"] = page_count
        if deadline is not UNSET:
            field_dict["deadline"] = deadline

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title")

        storage_id = d.pop("storage_id")

        file_size = d.pop("file_size")

        description = d.pop("description", UNSET)

        file_type = d.pop("file_type", UNSET)

        page_count = d.pop("page_count", UNSET)

        _deadline = d.pop("deadline", UNSET)
        deadline: datetime.datetime | Unset
        if isinstance(_deadline, Unset):
            deadline = UNSET
        else:
            deadline = datetime.datetime.fromisoformat(_deadline)

        create_document_body = cls(
            title=title,
            storage_id=storage_id,
            file_size=file_size,
            description=description,
            file_type=file_type,
            page_count=page_count,
            deadline=deadline,
        )

        create_document_body.additional_properties = d
        return create_document_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
