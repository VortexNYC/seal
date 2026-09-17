from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.template_status import TemplateStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="Template")


@_attrs_define
class Template:
    """
    Attributes:
        id (str):
        name (str):
        status (TemplateStatus):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
        use_count (int): Number of documents created from this template
        description (str | Unset):
        field_count (int | Unset):
    """

    id: str
    name: str
    status: TemplateStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    use_count: int
    description: str | Unset = UNSET
    field_count: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        use_count = self.use_count

        description = self.description

        field_count = self.field_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "name": name,
                "status": status,
                "created_at": created_at,
                "updated_at": updated_at,
                "use_count": use_count,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if field_count is not UNSET:
            field_dict["field_count"] = field_count

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        status = TemplateStatus(d.pop("status"))

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))

        use_count = d.pop("use_count")

        description = d.pop("description", UNSET)

        field_count = d.pop("field_count", UNSET)

        template = cls(
            id=id,
            name=name,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
            use_count=use_count,
            description=description,
            field_count=field_count,
        )

        template.additional_properties = d
        return template

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
