from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateFieldProperties")


@_attrs_define
class TemplateFieldProperties:
    """
    Attributes:
        placeholder (str | Unset):
        default_value (str | Unset):
        options (list[str] | Unset):
    """

    placeholder: str | Unset = UNSET
    default_value: str | Unset = UNSET
    options: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        placeholder = self.placeholder

        default_value = self.default_value

        options: list[str] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = self.options

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if placeholder is not UNSET:
            field_dict["placeholder"] = placeholder
        if default_value is not UNSET:
            field_dict["default_value"] = default_value
        if options is not UNSET:
            field_dict["options"] = options

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        placeholder = d.pop("placeholder", UNSET)

        default_value = d.pop("default_value", UNSET)

        options = cast(list[str], d.pop("options", UNSET))

        template_field_properties = cls(
            placeholder=placeholder,
            default_value=default_value,
            options=options,
        )

        template_field_properties.additional_properties = d
        return template_field_properties

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
