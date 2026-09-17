from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.template_status import TemplateStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="UpdateTemplateBody")


@_attrs_define
class UpdateTemplateBody:
    """
    Attributes:
        name (str | Unset):
        description (str | Unset):
        status (TemplateStatus | Unset):
    """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    status: TemplateStatus | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if status is not UNSET:
            field_dict["status"] = status

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _status = d.pop("status", UNSET)
        status: TemplateStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = TemplateStatus(_status)

        update_template_body = cls(
            name=name,
            description=description,
            status=status,
        )

        update_template_body.additional_properties = d
        return update_template_body

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
