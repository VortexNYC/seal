from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.field_type import FieldType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.template_field_properties import TemplateFieldProperties


T = TypeVar("T", bound="TemplateField")


@_attrs_define
class TemplateField:
    """
    Attributes:
        id (str):
        field_type (FieldType):
        is_required (bool):
        page (int): Page number (1-indexed)
        x (float): X position as a fraction of page width (0–1)
        y (float): Y position as a fraction of page height (0–1)
        width (float): Width as a fraction of page width (0–1)
        height (float): Height as a fraction of page height (0–1)
        label (str | Unset):
        properties (TemplateFieldProperties | Unset):
    """

    id: str
    field_type: FieldType
    is_required: bool
    page: int
    x: float
    y: float
    width: float
    height: float
    label: str | Unset = UNSET
    properties: TemplateFieldProperties | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        field_type = self.field_type.value

        is_required = self.is_required

        page = self.page

        x = self.x

        y = self.y

        width = self.width

        height = self.height

        label = self.label

        properties: dict[str, Any] | Unset = UNSET
        if not isinstance(self.properties, Unset):
            properties = self.properties.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "field_type": field_type,
                "is_required": is_required,
                "page": page,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
            }
        )
        if label is not UNSET:
            field_dict["label"] = label
        if properties is not UNSET:
            field_dict["properties"] = properties

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_field_properties import TemplateFieldProperties  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        field_type = FieldType(d.pop("field_type"))

        is_required = d.pop("is_required")

        page = d.pop("page")

        x = d.pop("x")

        y = d.pop("y")

        width = d.pop("width")

        height = d.pop("height")

        label = d.pop("label", UNSET)

        _properties = d.pop("properties", UNSET)
        properties: TemplateFieldProperties | Unset
        if isinstance(_properties, Unset):
            properties = UNSET
        else:
            properties = TemplateFieldProperties.from_dict(_properties)

        template_field = cls(
            id=id,
            field_type=field_type,
            is_required=is_required,
            page=page,
            x=x,
            y=y,
            width=width,
            height=height,
            label=label,
            properties=properties,
        )

        template_field.additional_properties = d
        return template_field

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
